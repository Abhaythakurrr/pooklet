import { createServer } from "node:http";
import { ZodError } from "zod";
import { BotOrchestrator } from "./bots";
import { config } from "./config";
import { PookletStore } from "./database";
import { readBody, readJson, requestToken, sendJson } from "./http";
import { OrderService, OrderServiceError } from "./orders";
import { createPaymentGateway } from "./payments";
import { serveWeb } from "./static";

const store = new PookletStore(config.databasePath);
const payments = createPaymentGateway(config);
const orders = new OrderService(store, config, payments);
const bots = new BotOrchestrator(store, orders, config);

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin === config.webOrigin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin");
    response.setHeader("access-control-allow-headers", "content-type, x-order-token");
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const path = url.pathname;

    if (request.method === "GET" && path === "/api/health") {
      sendJson(response, 200, {
        service: "pooklet-api",
        status: "ok",
        price: { amountPaise: 1_000, currency: "INR", display: "₹10" },
        payments: {
          provider: config.paymentProvider,
          checkoutConfigured: config.paymentConfigured,
          webhookConfigured: config.paymentWebhookConfigured,
        },
        channels: bots.status(),
      });
      return;
    }

    if (
      request.method === "POST" &&
      path === "/api/webhooks/telegram" &&
      config.telegramMode === "webhook"
    ) {
      await bots.handleTelegram(request.headers, await readBody(request, 256_000));
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && path === "/api/webhooks/razorpay") {
      const result = await orders.processPaymentWebhook(
        request.headers,
        await readBody(request, 512_000),
      );
      if (result.fulfilledOrderId) {
        // A delivery error returns a retryable webhook failure. Payment fulfillment
        // is already idempotent, so Razorpay can safely retry this event.
        await bots.deliverInvitation(result.fulfilledOrderId);
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && path === "/api/dev/bot" && !config.isProduction) {
      const input = (await readJson(request)) as {
        userId?: string;
        text?: string;
      };
      if (!input.userId || !input.text) {
        sendJson(response, 400, {
          error: "userId and text are required.",
          code: "validation_error",
        });
        return;
      }
      sendJson(response, 200, {
        replies: await bots.simulate(input.userId.slice(0, 120), input.text),
      });
      return;
    }

    if (request.method === "POST" && path === "/api/orders") {
      sendJson(response, 201, await orders.create(await readJson(request)));
      return;
    }

    const paymentSessionMatch = /^\/api\/orders\/([^/]+)\/payment-session$/.exec(path);
    if (request.method === "POST" && paymentSessionMatch) {
      sendJson(
        response,
        200,
        await orders.ensurePaymentSession(
          decodeURIComponent(paymentSessionMatch[1]!),
          requestToken(request, "x-order-token"),
        ),
      );
      return;
    }

    const verifyPaymentMatch = /^\/api\/orders\/([^/]+)\/verify-payment$/.exec(path);
    if (request.method === "POST" && verifyPaymentMatch) {
      const order = await orders.verifyCheckoutPayment(
        decodeURIComponent(verifyPaymentMatch[1]!),
        requestToken(request, "x-order-token"),
        await readJson(request),
      );
      try {
        await bots.deliverInvitation(order.id);
      } catch (deliveryError) {
        // The signed payment remains valid. The Razorpay webhook and Telegram
        // STATUS command both provide delivery recovery paths.
        console.error("Telegram invitation delivery failed", deliveryError);
      }
      sendJson(response, 200, order);
      return;
    }

    const mockPaymentMatch = /^\/api\/dev\/orders\/([^/]+)\/pay$/.exec(path);
    if (request.method === "POST" && mockPaymentMatch && !config.isProduction) {
      sendJson(
        response,
        200,
        await orders.completeMockPayment(
          decodeURIComponent(mockPaymentMatch[1]!),
          requestToken(request, "x-order-token"),
        ),
      );
      return;
    }

    const orderMatch = /^\/api\/orders\/([^/]+)$/.exec(path);
    if (request.method === "GET" && orderMatch) {
      sendJson(
        response,
        200,
        await orders.get(
          decodeURIComponent(orderMatch[1]!),
          requestToken(request, "x-order-token"),
        ),
      );
      return;
    }

    const shortInvitationMatch = /^\/api\/p\/([^/]+)$/.exec(path);
    if (request.method === "GET" && shortInvitationMatch) {
      sendJson(
        response,
        200,
        orders.getInvitationBySlug(decodeURIComponent(shortInvitationMatch[1]!)),
      );
      return;
    }

    const invitationMatch = /^\/api\/invitations\/([^/]+)$/.exec(path);
    if (request.method === "GET" && invitationMatch) {
      sendJson(
        response,
        200,
        orders.getInvitation(decodeURIComponent(invitationMatch[1]!)),
      );
      return;
    }

    if (await serveWeb(request, response, path)) return;
    sendJson(response, 404, { error: "Not found.", code: "not_found" });
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, {
        error: "Some details need attention.",
        code: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    if (error instanceof OrderServiceError) {
      sendJson(response, error.statusCode, { error: error.message, code: error.code });
      return;
    }

    const candidate =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 500;
    const statusCode =
      Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
    if (statusCode >= 500) console.error("Unhandled API error", error);
    sendJson(response, statusCode, {
      error:
        statusCode >= 500
          ? "This request could not be completed."
          : error instanceof Error
            ? error.message
            : "This request was not accepted.",
      code: statusCode >= 500 ? "internal_error" : "invalid_request",
    });
  }
});

server.listen(config.port, () => {
  console.log(`Pooklet API listening on http://localhost:${config.port}`);
  if (!config.paymentConfigured) {
    console.warn("Razorpay is not configured; checkout cannot accept payments.");
  }
  if (config.paymentProvider === "razorpay" && !config.paymentWebhookConfigured) {
    console.warn("Razorpay webhook verification is waiting for RAZORPAY_WEBHOOK_SECRET.");
  }
  bots.start();
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing Pooklet.`);
  bots.stop();
  server.close((error) => {
    if (error) {
      console.error("Pooklet did not close cleanly", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
