export const BOT_CHANNEL_IDS = ["telegram"] as const;
export type BotChannelId = (typeof BOT_CHANNEL_IDS)[number];

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export type InboundMessage = {
  channel: BotChannelId;
  eventId: string;
  senderId: string;
  recipientId: string;
  text: string;
  receivedAt: string;
};

export type ChannelSendResult = {
  providerMessageId?: string;
};

export interface ChannelAdapter {
  readonly id: BotChannelId;
  readonly configured: boolean;
  verifyWebhook(headers: WebhookHeaders, rawBody: string): boolean;
  normalizeWebhook(rawBody: string): InboundMessage[];
  sendText(recipientId: string, text: string): Promise<ChannelSendResult>;
}

export function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function splitMessage(text: string, maximumLength: number): string[] {
  if (text.length <= maximumLength) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maximumLength) {
    const breakAt = Math.max(
      remaining.lastIndexOf("\n", maximumLength),
      remaining.lastIndexOf(" ", maximumLength),
    );
    const end = breakAt > maximumLength * 0.6 ? breakAt : maximumLength;
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
