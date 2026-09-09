import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import {
  createOrderRequestSchema,
  ORDER_CURRENCY,
  ORDER_PRICE_PAISE,
  storySnapshotSchema,
  type CreateOrderRequest,
  type StorySnapshot,
} from "@pooklet/domain";
import type { OrderRecord, PookletStore } from "./database";
import type { PaymentGateway } from "./payments";

export class OrderServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
  }
}

type OrderServiceConfig = {
  paymentConfigured: boolean;
  publicBaseUrl: string;
  invitationSecret: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const nowIso = () => new Date().toISOString();

function safeHashMatch(actualHash: string, providedToken: string): boolean {
  const expected = Buffer.from(actualHash, "hex");
  const actual = Buffer.from(sha256(providedToken), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createOrderId(): string {
  const day = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `PKT-${day}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

const CUTE_SLUG_ADJECTIVES = [
  "blushing",
  "cozy",
  "dreamy",
  "gentle",
  "little",
  "moonlit",
  "peachy",
  "soft",
] as const;
const CUTE_SLUG_NOUNS = [
  "blossom",
  "cloud",
  "letter",
  "petal",
  "pooklet",
  "starlight",
  "wish",
  "window",
] as const;

function createInvitationSlug(): string {
  const entropy = randomBytes(14);
  const adjective = CUTE_SLUG_ADJECTIVES[entropy[0]! % CUTE_SLUG_ADJECTIVES.length];
  const noun = CUTE_SLUG_NOUNS[entropy[1]! % CUTE_SLUG_NOUNS.length];
  return `${adjective}-${noun}-${entropy.subarray(2).toString("base64url")}`;
}

function invitationToken(secret: string, order: OrderRecord): string {
  return createHmac("sha256", secret)
    .update(`${order.id}:${order.snapshot_hash}`)
    .digest("base64url");
}

export class OrderService {
  constructor(
    private readonly store: PookletStore,
    private readonly config: OrderServiceConfig,
    private readonly payments: PaymentGateway,
  ) {}

  async create(input: unknown) {
    const parsed = createOrderRequestSchema.parse(input);
    const createdAt = nowIso();
    const id = createOrderId();
    const accessToken = randomBytes(24).toString("base64url");
    const snapshot = storySnapshotSchema.parse({
      schemaVersion: 1,
      createdAt,
      gift: parsed.gift,
    });
    const snapshotJson = JSON.stringify(snapshot);

    // Create the provider order first so a provider failure cannot strand an
    // inaccessible local order whose one-time checkout token was never returned.
    const paymentSession = await this.payments.createOrder({
      localOrderId: id,
      amountPaise: ORDER_PRICE_PAISE,
      currency: ORDER_CURRENCY,
    });

    const order = this.store.createOrder({
      id,
      access_token_hash: sha256(accessToken),
      source: parsed.source,
      template_id: parsed.gift.templateId,
      to_name: parsed.gift.toName,
      from_name: parsed.gift.fromName,
      snapshot_json: snapshotJson,
      snapshot_hash: sha256(snapshotJson),
      amount_paise: ORDER_PRICE_PAISE,
      currency: ORDER_CURRENCY,
      status: "awaiting_payment",
      upi_uri: "",
      payment_provider: paymentSession.provider,
      provider_order_id: paymentSession.providerOrderId,
      payment_status: "created",
      created_at: createdAt,
      updated_at: createdAt,
    });

    return {
      ...(await this.present(order)),
      accessToken,
    };
  }

  async ensurePaymentSession(id: string, accessToken: string | undefined) {
    const order = this.authorize(id, accessToken);
    return this.present((await this.ensurePaymentSessionForOrder(order)).order);
  }

  async processPaymentWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    const captured = this.payments.parseCapturedWebhook(headers, rawBody);
    if (!captured) return { accepted: true, fulfilledOrderId: null as string | null };

    const current = this.store.getOrderByProviderOrder(
      captured.provider,
      captured.providerOrderId,
    );
    if (!current) {
      throw new OrderServiceError(
        "Payment order unavailable.",
        404,
        "payment_order_unavailable",
      );
    }

    const token = invitationToken(this.config.invitationSecret, current);
    const result = this.store.recordCapturedPayment({
      provider: captured.provider,
      eventId: captured.eventId,
      eventType: captured.eventType,
      payloadHash: sha256(captured.payloadHashSource),
      providerOrderId: captured.providerOrderId,
      providerPaymentId: captured.providerPaymentId,
      amountPaise: captured.amountPaise,
      currency: captured.currency,
      invitationId: `INV-${randomBytes(10).toString("hex")}`,
      tokenHash: sha256(token),
      slug: createInvitationSlug(),
      now: nowIso(),
    });

    // Return the order for duplicate events too, allowing a webhook retry to
    // retry Telegram delivery after fulfillment was already committed.
    return { accepted: true, fulfilledOrderId: result.order.id };
  }

  async verifyCheckoutPayment(id: string, accessToken: string | undefined, input: unknown) {
    const order = this.authorize(id, accessToken);
    const body = input as Record<string, unknown>;
    const providerPaymentId =
      typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const providerOrderId =
      typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const signature =
      typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

    if (
      order.payment_provider !== "razorpay" ||
      !providerPaymentId ||
      !providerOrderId ||
      !signature ||
      providerOrderId !== order.provider_order_id
    ) {
      throw new OrderServiceError(
        "Payment verification fields are invalid.",
        400,
        "invalid_payment_verification",
      );
    }
    if (
      !this.payments.verifyCheckoutSignature({
        providerOrderId,
        providerPaymentId,
        signature,
      })
    ) {
      throw new OrderServiceError(
        "Payment signature did not match.",
        400,
        "payment_signature_mismatch",
      );
    }

    const token = invitationToken(this.config.invitationSecret, order);
    const result = this.store.recordCapturedPayment({
      provider: "razorpay",
      eventId: `checkout:${providerPaymentId}`,
      eventType: "checkout.signature_verified",
      payloadHash: sha256(`${providerOrderId}|${providerPaymentId}|${signature}`),
      providerOrderId,
      providerPaymentId,
      amountPaise: order.amount_paise,
      currency: order.currency,
      invitationId: `INV-${randomBytes(10).toString("hex")}`,
      tokenHash: sha256(token),
      slug: createInvitationSlug(),
      now: nowIso(),
    });
    return this.present(result.order);
  }

  async completeMockPayment(id: string, accessToken: string | undefined) {
    if (this.payments.name !== "mock") {
      throw new OrderServiceError("Not found.", 404, "not_found");
    }
    const order = this.authorize(id, accessToken);
    const ready = (await this.ensurePaymentSessionForOrder(order)).order;
    const token = invitationToken(this.config.invitationSecret, ready);
    const result = this.store.recordCapturedPayment({
      provider: "mock",
      eventId: `mock-event-${ready.id}`,
      eventType: "order.paid",
      payloadHash: sha256(ready.id),
      providerOrderId: ready.provider_order_id!,
      providerPaymentId: `mock-payment-${ready.id}`,
      amountPaise: ready.amount_paise,
      currency: ready.currency,
      invitationId: `INV-${randomBytes(10).toString("hex")}`,
      tokenHash: sha256(token),
      slug: createInvitationSlug(),
      now: nowIso(),
    });
    return this.present(result.order);
  }

  private async ensurePaymentSessionForOrder(order: OrderRecord) {
    if (order.provider_order_id) return { order };
    const session = await this.payments.createOrder({
      localOrderId: order.id,
      amountPaise: order.amount_paise,
      currency: order.currency,
    });
    return {
      order: this.store.attachPaymentOrder(
        order.id,
        session.provider,
        session.providerOrderId,
        nowIso(),
      ),
    };
  }

  async get(id: string, accessToken: string | undefined) {
    return this.present(this.authorize(id, accessToken));
  }

  async getTrusted(id: string) {
    const order = this.store.getOrder(id);
    if (!order) {
      throw new OrderServiceError("Order not found.", 404, "order_not_found");
    }
    return this.present(order);
  }

  getInvitation(rawToken: string): StorySnapshot {
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(rawToken)) {
      throw new OrderServiceError(
        "Invitation unavailable.",
        404,
        "invitation_unavailable",
      );
    }
    const invitation = this.store.getInvitation(sha256(rawToken));
    if (!invitation) {
      throw new OrderServiceError(
        "Invitation unavailable.",
        404,
        "invitation_unavailable",
      );
    }
    return storySnapshotSchema.parse(JSON.parse(invitation.snapshot_json));
  }

  getInvitationBySlug(rawSlug: string): StorySnapshot {
    if (!/^[a-z]{3,12}-[a-z]{3,12}-[A-Za-z0-9_-]{16}$/.test(rawSlug)) {
      throw new OrderServiceError(
        "Invitation unavailable.",
        404,
        "invitation_unavailable",
      );
    }
    const invitation = this.store.getInvitationBySlug(rawSlug);
    if (!invitation) {
      throw new OrderServiceError(
        "Invitation unavailable.",
        404,
        "invitation_unavailable",
      );
    }
    return storySnapshotSchema.parse(JSON.parse(invitation.snapshot_json));
  }

  private authorize(id: string, accessToken: string | undefined): OrderRecord {
    const order = this.store.getOrder(id);
    if (!order || !accessToken || !safeHashMatch(order.access_token_hash, accessToken)) {
      throw new OrderServiceError("Order unavailable.", 404, "order_unavailable");
    }
    return order;
  }

  private async present(order: OrderRecord) {
    let invitation =
      order.status === "fulfilled"
        ? this.store.getInvitationForOrder(order.id)
        : undefined;
    if (invitation && !invitation.slug) {
      invitation = this.store.setInvitationSlug(order.id, createInvitationSlug());
    }
    const invitationUrl = invitation?.slug
      ? `${this.config.publicBaseUrl}/p/${invitation.slug}`
      : null;

    return {
      id: order.id,
      source: order.source,
      templateId: order.template_id,
      toName: order.to_name,
      fromName: order.from_name,
      amountPaise: order.amount_paise,
      amountDisplay: "₹10",
      currency: order.currency,
      status: order.status,
      paymentConfigured: this.config.paymentConfigured,
      payment:
        order.provider_order_id && order.payment_provider
          ? {
              provider: order.payment_provider,
              providerOrderId: order.provider_order_id,
              publicKey: this.payments.publicKey,
              status: order.payment_status,
              mock: this.payments.name === "mock",
            }
          : null,
      invitationUrl,
      invitationQrCodeDataUrl: invitationUrl
        ? await QRCode.toDataURL(invitationUrl, {
            width: 560,
            margin: 2,
            errorCorrectionLevel: "H",
            color: { dark: "#703A56FF", light: "#FFF9F2FF" },
          })
        : undefined,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }
}

export type { CreateOrderRequest };
