import { randomUUID } from "node:crypto";
import {
  advanceConversation,
  FakeChannelAdapter,
  TelegramAdapter,
  type ChannelAdapter,
  type ConversationSession,
  type InboundMessage,
  type WebhookHeaders,
} from "@pooklet/channels";
import type { PookletStore } from "./database";
import type { OrderService } from "./orders";

type BotConfig = {
  publicBaseUrl: string;
  paymentConfigured: boolean;
  telegramMode: "polling" | "webhook";
  telegramBotToken: string;
  telegramWebhookSecret: string;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function pngDataUrlBytes(value: string): Uint8Array {
  const match = /^data:image\/png;base64,(.+)$/.exec(value);
  if (!match) throw new Error("The invitation QR is not a PNG data URL.");
  return Buffer.from(match[1]!, "base64");
}

export class BotOrchestrator {
  readonly telegram: TelegramAdapter;
  private pollingAbort: AbortController | undefined;

  constructor(
    private readonly store: PookletStore,
    private readonly orders: OrderService,
    private readonly config: BotConfig,
  ) {
    this.telegram = new TelegramAdapter(
      config.telegramBotToken,
      config.telegramWebhookSecret,
    );
  }

  status() {
    return {
      telegram: {
        configured: this.telegram.configured,
        mode: this.config.telegramMode,
        active:
          this.telegram.configured &&
          (this.config.telegramMode === "polling" || this.telegram.webhookConfigured),
      },
    };
  }

  start() {
    if (this.config.telegramMode !== "polling" || this.pollingAbort) return;
    if (!this.telegram.configured) {
      console.warn("Telegram polling is waiting for TELEGRAM_BOT_TOKEN.");
      return;
    }
    this.pollingAbort = new AbortController();
    void this.pollTelegram(this.pollingAbort.signal);
  }

  stop() {
    this.pollingAbort?.abort();
    this.pollingAbort = undefined;
  }

  async handleTelegram(headers: WebhookHeaders, rawBody: string) {
    await this.handleVerified(this.telegram, headers, rawBody);
  }

  async simulate(userId: string, text: string) {
    const adapter = new FakeChannelAdapter("telegram");
    await this.processEvent(
      {
        channel: "telegram",
        eventId: randomUUID(),
        senderId: userId,
        recipientId: "local-pooklet-bot",
        text,
        receivedAt: new Date().toISOString(),
      },
      adapter,
    );
    return adapter.sent.map((message) => message.text);
  }

  async deliverInvitation(orderId: string): Promise<boolean> {
    if (!this.telegram.configured) return false;
    const match = this.store.findBotSessionByOrder("telegram", orderId);
    if (!match) return false;

    let session: ConversationSession;
    try {
      session = JSON.parse(match.sessionJson) as ConversationSession;
    } catch {
      return false;
    }
    if (session.invitationDeliveredAt) return false;

    const order = await this.orders.getTrusted(orderId);
    if (order.status !== "fulfilled" || !order.invitationUrl) return false;
    await this.sendInvitation(
      match.userId,
      order.toName,
      order.invitationUrl,
      order.invitationQrCodeDataUrl,
    );
    this.store.saveBotSession(
      "telegram",
      match.userId,
      JSON.stringify({ ...session, invitationDeliveredAt: new Date().toISOString() }),
    );
    return true;
  }

  private async pollTelegram(signal: AbortSignal) {
    let offset: number | undefined;
    let prepared = false;
    console.log("Telegram long polling started.");

    while (!signal.aborted) {
      try {
        if (!prepared) {
          await this.telegram.preparePolling(signal);
          prepared = true;
        }
        const batch = await this.telegram.getUpdates(offset, signal);
        for (const event of batch.events) await this.processEvent(event, this.telegram);
        offset = batch.nextOffset;
      } catch (error) {
        if (signal.aborted) return;
        console.error("Telegram polling error", error);
        await wait(2_000);
      }
    }
  }

  private async handleVerified(
    adapter: ChannelAdapter,
    headers: WebhookHeaders,
    rawBody: string,
  ) {
    if (!adapter.verifyWebhook(headers, rawBody)) {
      throw Object.assign(new Error("Webhook signature was not accepted."), { statusCode: 401 });
    }
    for (const event of adapter.normalizeWebhook(rawBody)) {
      await this.processEvent(event, adapter);
    }
  }

  private loadSession(userId: string): ConversationSession | undefined {
    const stored = this.store.getBotSession("telegram", userId);
    if (!stored) return undefined;
    try {
      return JSON.parse(stored) as ConversationSession;
    } catch {
      return undefined;
    }
  }

  private async processEvent(event: InboundMessage, adapter: ChannelAdapter) {
    if (!this.store.claimBotEvent("telegram", event.eventId)) return;
    const current = this.loadSession(event.senderId);
    const normalized = event.text.trim().toLowerCase();

    if (current?.step === "awaiting_payment" && current.orderId) {
      if (["restart", "start", "/start"].includes(normalized)) {
        const order = await this.orders.getTrusted(current.orderId);
        if (order.status === "fulfilled") {
          const restarted = advanceConversation(undefined, "start");
          this.saveSession(event.senderId, restarted.session);
          await this.sendAll(adapter, event.senderId, restarted.replies);
        } else {
          await adapter.sendText(
            event.senderId,
            `Order ${order.id} is still awaiting payment. Use its secure checkout link or reply STATUS before starting another Pooklet.`,
          );
        }
        return;
      }
      if (normalized === "status") {
        const order = await this.orders.getTrusted(current.orderId);
        if (order.status === "fulfilled" && order.invitationUrl) {
          if (!current.invitationDeliveredAt && this.telegram.configured) {
            await this.sendInvitation(
              event.senderId,
              order.toName,
              order.invitationUrl,
              order.invitationQrCodeDataUrl,
            );
            this.saveSession(event.senderId, {
              ...current,
              invitationDeliveredAt: new Date().toISOString(),
            });
          } else {
            await adapter.sendText(
              event.senderId,
              `Your private Pooklet is ready ✨\n${order.invitationUrl}`,
            );
          }
          return;
        }
        await adapter.sendText(
          event.senderId,
          `Order ${order.id} is awaiting payment. Open the secure checkout link from the earlier message, then reply STATUS.`,
        );
        return;
      }
      await adapter.sendText(
        event.senderId,
        "Payment is handled only in the secure checkout. Open the earlier link, then reply STATUS to check confirmation.",
      );
      return;
    }

    const result = advanceConversation(current, event.text);
    let nextSession = result.session;
    const replies = [...result.replies];

    if (result.completedGift) {
      const order = await this.orders.create({ source: "telegram", gift: result.completedGift });
      nextSession = { ...result.session, step: "awaiting_payment", orderId: order.id };
      const checkoutUrl = `${this.config.publicBaseUrl.replace(/\/$/, "")}/checkout/${order.id}#${order.accessToken}`;
      replies.push(
        `Order ${order.id} is ready for ₹10.\n\nOpen Razorpay secure checkout:\n${checkoutUrl}\n\nPayment is verified automatically. Reply STATUS if you want to check it.`,
      );
      if (!this.config.paymentConfigured) {
        replies.push("Setup note: Razorpay is not configured yet, so checkout cannot accept payment.");
      }
    }

    this.saveSession(event.senderId, nextSession);
    await this.sendAll(adapter, event.senderId, replies);
  }

  private async sendInvitation(
    recipientId: string,
    toName: string,
    invitationUrl: string,
    qrDataUrl?: string,
  ) {
    const caption = `A private Pooklet for ${toName} is ready ✨\n\n${invitationUrl}\n\nSend this QR or cute link to them.`;
    if (qrDataUrl) {
      await this.telegram.sendPhoto(recipientId, pngDataUrlBytes(qrDataUrl), caption);
      return;
    }
    await this.telegram.sendText(recipientId, caption);
  }

  private saveSession(userId: string, session: ConversationSession) {
    this.store.saveBotSession("telegram", userId, JSON.stringify(session));
  }

  private async sendAll(adapter: ChannelAdapter, recipientId: string, replies: string[]) {
    for (const reply of replies) await adapter.sendText(recipientId, reply);
  }
}
