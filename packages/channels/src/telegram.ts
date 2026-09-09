import { timingSafeEqual } from "node:crypto";
import {
  headerValue,
  splitMessage,
  type ChannelAdapter,
  type ChannelSendResult,
  type InboundMessage,
  type WebhookHeaders,
} from "./types";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    chat?: { id?: number | string };
  };
};

type TelegramApiResponse<T> = {
  ok?: boolean;
  description?: string;
  result?: T;
};

function secureEqual(expected: string, actual: string | undefined): boolean {
  if (!actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeUpdate(update: TelegramUpdate): InboundMessage[] {
  const message = update.message;
  if (!message?.text || message.chat?.id === undefined || update.update_id === undefined) return [];
  return [
    {
      channel: "telegram",
      eventId: String(update.update_id),
      senderId: String(message.chat.id),
      recipientId: "pooklet-bot",
      text: message.text,
      receivedAt: message.date
        ? new Date(message.date * 1_000).toISOString()
        : new Date().toISOString(),
    },
  ];
}

export class TelegramAdapter implements ChannelAdapter {
  readonly id = "telegram" as const;
  readonly configured: boolean;
  readonly webhookConfigured: boolean;

  constructor(
    private readonly botToken: string,
    private readonly webhookSecret: string,
  ) {
    this.configured = Boolean(botToken);
    this.webhookConfigured = Boolean(botToken && webhookSecret);
  }

  verifyWebhook(headers: WebhookHeaders): boolean {
    return (
      this.webhookConfigured &&
      secureEqual(
        this.webhookSecret,
        headerValue(headers, "x-telegram-bot-api-secret-token"),
      )
    );
  }

  normalizeWebhook(rawBody: string): InboundMessage[] {
    return normalizeUpdate(JSON.parse(rawBody) as TelegramUpdate);
  }

  async preparePolling(signal?: AbortSignal): Promise<void> {
    await this.callJson("deleteWebhook", { drop_pending_updates: false }, signal);
  }

  async getUpdates(
    offset: number | undefined,
    signal?: AbortSignal,
  ): Promise<{ events: InboundMessage[]; nextOffset: number | undefined }> {
    const updates = await this.callJson<TelegramUpdate[]>(
      "getUpdates",
      {
        ...(offset === undefined ? {} : { offset }),
        timeout: 25,
        allowed_updates: ["message"],
      },
      signal,
    );
    const lastUpdateId = updates.reduce(
      (highest, update) => Math.max(highest, update.update_id ?? highest),
      offset === undefined ? -1 : offset - 1,
    );
    return {
      events: updates.flatMap(normalizeUpdate),
      nextOffset: lastUpdateId >= 0 ? lastUpdateId + 1 : offset,
    };
  }

  async sendText(recipientId: string, text: string): Promise<ChannelSendResult> {
    let providerMessageId: string | undefined;
    for (const part of splitMessage(text, 4_000)) {
      const result = await this.callJson<{ message_id?: number }>("sendMessage", {
        chat_id: recipientId,
        text: part,
        disable_web_page_preview: false,
      });
      if (result.message_id !== undefined) providerMessageId = String(result.message_id);
    }
    return providerMessageId ? { providerMessageId } : {};
  }

  async sendPhoto(
    recipientId: string,
    imageBytes: Uint8Array,
    caption?: string,
  ): Promise<ChannelSendResult> {
    if (!this.configured) throw new Error("Telegram is not configured.");
    const form = new FormData();
    form.set("chat_id", recipientId);
    form.set(
      "photo",
      new Blob([Uint8Array.from(imageBytes)], { type: "image/png" }),
      "pooklet-invitation-qr.png",
    );
    if (caption) form.set("caption", caption.slice(0, 1_024));

    const response = await fetch(this.apiUrl("sendPhoto"), { method: "POST", body: form });
    const payload = (await response.json()) as TelegramApiResponse<{ message_id?: number }>;
    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.description || "Telegram could not send the photo.");
    }
    return payload.result.message_id === undefined
      ? {}
      : { providerMessageId: String(payload.result.message_id) };
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  private async callJson<T = true>(
    method: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!this.configured) throw new Error("Telegram is not configured.");
    const response = await fetch(this.apiUrl(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    const payload = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
      throw new Error(payload.description || `Telegram ${method} failed.`);
    }
    return payload.result;
  }
}
