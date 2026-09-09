import type {
  BotChannelId,
  ChannelAdapter,
  ChannelSendResult,
  InboundMessage,
} from "./types";

export class FakeChannelAdapter implements ChannelAdapter {
  readonly configured = true;
  readonly sent: Array<{ recipientId: string; text: string }> = [];

  constructor(readonly id: BotChannelId) {}

  verifyWebhook(): boolean {
    return true;
  }

  normalizeWebhook(): InboundMessage[] {
    return [];
  }

  async sendText(recipientId: string, text: string): Promise<ChannelSendResult> {
    this.sent.push({ recipientId, text });
    return { providerMessageId: `fake-${this.sent.length}` };
  }
}
