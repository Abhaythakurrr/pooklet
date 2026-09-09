import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type { WebhookHeaders } from "@pooklet/channels";

export type PaymentSession = {
  provider: "razorpay" | "mock";
  providerOrderId: string;
  publicKey: string | null;
  checkoutUrl: string | null;
};

export type CapturedPayment = {
  provider: "razorpay";
  eventId: string;
  eventType: "order.paid";
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  payloadHashSource: string;
};

export interface PaymentGateway {
  readonly name: "razorpay" | "mock";
  readonly configured: boolean;
  readonly publicKey: string | null;
  createOrder(input: {
    localOrderId: string;
    amountPaise: number;
    currency: "INR";
  }): Promise<PaymentSession>;
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;
  parseCapturedWebhook(headers: WebhookHeaders, rawBody: string): CapturedPayment | null;
}

type PaymentConfig = {
  paymentProvider: "razorpay" | "mock";
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  razorpayAccountId: string;
  isProduction: boolean;
};

type RazorpayWebhookPayload = {
  event?: string;
  account_id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        captured?: boolean;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

function paymentError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function header(headers: WebhookHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function secureHexEqual(expected: string, actual: string | undefined): boolean {
  if (!actual || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export class RazorpayGateway implements PaymentGateway {
  readonly name = "razorpay" as const;
  readonly configured: boolean;
  readonly publicKey: string;
  private readonly client: Razorpay | null;

  constructor(private readonly config: PaymentConfig) {
    this.publicKey = config.razorpayKeyId;
    this.configured = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
    this.client = this.configured
      ? new Razorpay({
          key_id: config.razorpayKeyId,
          key_secret: config.razorpayKeySecret,
        })
      : null;
  }

  async createOrder(input: {
    localOrderId: string;
    amountPaise: number;
    currency: "INR";
  }): Promise<PaymentSession> {
    if (!this.client) {
      throw paymentError("Razorpay is not configured.", 503);
    }
    if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
      throw paymentError("The payment amount must be at least 100 paise.", 400);
    }

    try {
      const order = await this.client.orders.create({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.localOrderId.slice(0, 40),
        notes: { pooklet_order_id: input.localOrderId },
      });
      if (
        !order.id ||
        Number(order.amount) !== input.amountPaise ||
        order.currency !== input.currency
      ) {
        throw paymentError("Razorpay returned an invalid order.", 502);
      }
      return {
        provider: "razorpay",
        providerOrderId: order.id,
        publicKey: this.publicKey,
        checkoutUrl: null,
      };
    } catch (error) {
      const candidate =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 502;
      const statusCode = candidate === 401 ? 401 : candidate === 400 ? 400 : 502;
      const message =
        statusCode === 401
          ? "Razorpay rejected the configured API credentials."
          : statusCode === 400
            ? error instanceof Error
              ? error.message
              : "Razorpay rejected the order."
            : "Razorpay could not create the order.";
      throw paymentError(message, statusCode);
    }
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    if (!this.configured) return false;
    const expected = createHmac("sha256", this.config.razorpayKeySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex");
    return secureHexEqual(expected, input.signature);
  }

  parseCapturedWebhook(headers: WebhookHeaders, rawBody: string): CapturedPayment | null {
    if (!this.config.razorpayWebhookSecret) {
      throw paymentError("Payment webhook secret is not configured.", 503);
    }

    const expected = createHmac("sha256", this.config.razorpayWebhookSecret)
      .update(rawBody)
      .digest("hex");
    if (!secureHexEqual(expected, header(headers, "x-razorpay-signature"))) {
      throw paymentError("Payment webhook signature was not accepted.", 401);
    }

    const eventId = header(headers, "x-razorpay-event-id");
    if (!eventId || eventId.length > 200) {
      throw paymentError("Payment webhook event ID is missing.", 400);
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      throw paymentError("Payment webhook JSON was invalid.", 400);
    }

    if (payload.event !== "order.paid") return null;
    if (this.config.razorpayAccountId && payload.account_id !== this.config.razorpayAccountId) {
      throw paymentError("Payment webhook account did not match.", 400);
    }

    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    if (
      !payment?.id ||
      !payment.order_id ||
      typeof payment.amount !== "number" ||
      !payment.currency ||
      payment.status !== "captured" ||
      payment.captured !== true ||
      !order?.id ||
      order.id !== payment.order_id ||
      order.status !== "paid" ||
      payment.amount !== order.amount ||
      payment.currency !== order.currency
    ) {
      throw paymentError("Payment webhook payload was not a captured order.", 400);
    }

    return {
      provider: "razorpay",
      eventId,
      eventType: "order.paid",
      providerOrderId: order.id,
      providerPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
      payloadHashSource: rawBody,
    };
  }
}

class MockGateway implements PaymentGateway {
  readonly name = "mock" as const;
  readonly configured = true;
  readonly publicKey = null;

  async createOrder(input: {
    localOrderId: string;
    amountPaise: number;
    currency: "INR";
  }): Promise<PaymentSession> {
    return {
      provider: "mock",
      providerOrderId: `mock_${input.localOrderId}`,
      publicKey: null,
      checkoutUrl: null,
    };
  }

  verifyCheckoutSignature(): boolean {
    return true;
  }

  parseCapturedWebhook(): CapturedPayment | null {
    return null;
  }
}

export function createPaymentGateway(config: PaymentConfig): PaymentGateway {
  if (config.paymentProvider === "mock") {
    if (config.isProduction) throw new Error("Mock payments cannot run in production.");
    return new MockGateway();
  }
  return new RazorpayGateway(config);
}
