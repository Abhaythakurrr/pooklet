import {
  MAX_OCCUPANTS,
  decodeClient,
  encode,
  type RoomConfig,
  type ServerMessage,
  type Slot,
} from '../shared/protocol';

interface Attachment {
  slot: Slot;
}

/**
 * One Durable Object per invite link.
 *
 * Holds the occasion config, both participants' presence and poses, relays
 * WebRTC signalling, and gates zone transitions so neither person is dragged
 * forward or left behind in a space being disposed.
 *
 * Uses the WebSocket hibernation API, so an idle room costs nothing while the
 * two of them are still deciding when to meet.
 */
export class RoomDO {
  private readonly state: DurableObjectState;
  private config: RoomConfig | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/config') && request.method === 'PUT') {
      const body = (await request.json()) as RoomConfig;
      this.config = body;
      await this.state.storage.put('config', body);
      return Response.json({ ok: true });
    }

    if (url.pathname.endsWith('/config')) {
      const config = await this.loadConfig();
      return Response.json(config);
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const existing = this.state.getWebSockets();
    if (existing.length >= MAX_OCCUPANTS) {
      // Strictly two. A third participant would break the emotional frame, the
      // voice architecture, and the one structural advantage the product has.
      return new Response(encode({ t: 'full' }), { status: 409 });
    }

    const taken = new Set(
      existing.map((ws) => (ws.deserializeAttachment() as Attachment | null)?.slot),
    );
    const slot: Slot = taken.has(0) ? 1 : 0;

    const pair = new WebSocketPair();
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ slot } satisfies Attachment);

    const config = await this.loadConfig();
    const peerPresent = existing.length > 0;

    server.send(
      encode({
        t: 'welcome',
        slot,
        config,
        peerPresent,
        // Slot 1 offers. Deterministic so the two sides never both offer.
        shouldOffer: slot === 1 && peerPresent,
      } satisfies ServerMessage),
    );

    if (peerPresent) {
      this.broadcastExcept(server, { t: 'peer-join' });
    }

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string') return;
    const message = decodeClient(raw);
    if (!message) return;

    switch (message.t) {
      case 'hello':
        // Presence is already established by the socket itself; nothing to do.
        break;
      case 'pose':
        this.broadcastExcept(ws, { t: 'pose', pose: message.pose });
        break;
      case 'ready':
        this.broadcastExcept(ws, { t: 'ready', zone: message.zone });
        break;
      case 'signal':
        // Relayed verbatim. The room never inspects SDP or ICE.
        this.broadcastExcept(ws, { t: 'signal', data: message.data });
        break;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.broadcastExcept(ws, { t: 'peer-leave' });
  }

  webSocketError(ws: WebSocket): void {
    this.broadcastExcept(ws, { t: 'peer-leave' });
  }

  private broadcastExcept(sender: WebSocket, message: ServerMessage): void {
    const payload = encode(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws === sender) continue;
      try {
        ws.send(payload);
      } catch {
        // A dead socket will be cleaned up by the close handler.
      }
    }
  }

  private async loadConfig(): Promise<RoomConfig> {
    if (this.config) return this.config;
    const stored = await this.state.storage.get<RoomConfig>('config');
    this.config = stored ?? { occasion: 'birthday', recipient: '' };
    return this.config;
  }
}
