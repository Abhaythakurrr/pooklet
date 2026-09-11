import {
  decodeServer,
  encode,
  type ClientMessage,
  type Pose,
  type RoomConfig,
  type Slot,
} from '../../shared/protocol';

/** Pose send rate. 12Hz is plenty for two people walking; interpolation covers it. */
const POSE_HZ = 12;

export interface RoomHandlers {
  onWelcome(slot: Slot, config: RoomConfig, shouldOffer: boolean): void;
  onPeerJoin(): void;
  onPeerLeave(): void;
  onPeerPose(pose: Pose): void;
  onPeerReady(zone: string): void;
  onSignal(data: unknown): void;
  onFull(): void;
  onStatus(text: string): void;
}

/**
 * Client half of the room.
 *
 * Networking and voice are the highest-risk parts of this product — far more
 * likely to sink it than rendering is — so this stays deliberately small and
 * observable. See .kiro/steering/working-method.md -> "Prove the risky things
 * first".
 */
export class Room {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly handlers: RoomHandlers;

  private sinceLastPose = 0;
  private lastSent: Pose = { x: NaN, z: NaN, ry: NaN };

  private reconnectDelay = 500;
  private closedByUs = false;

  slot: Slot = 0;
  peerPresent = false;

  constructor(baseUrl: string, code: string, handlers: RoomHandlers) {
    const scheme = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.url = `${scheme}://${host}/api/rooms/${code}/socket`;
    this.handlers = handlers;
  }

  connect(): void {
    this.closedByUs = false;
    this.handlers.onStatus('finding the door…');

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectDelay = 500;
      this.send({ t: 'hello' });
    });

    socket.addEventListener('message', (event) => {
      const message = decodeServer(String(event.data));
      if (!message) return;

      switch (message.t) {
        case 'welcome':
          this.slot = message.slot;
          this.peerPresent = message.peerPresent;
          this.handlers.onWelcome(message.slot, message.config, message.shouldOffer);
          this.handlers.onStatus(
            message.peerPresent ? 'she is here' : 'waiting for her…',
          );
          break;
        case 'peer-join':
          this.peerPresent = true;
          this.handlers.onPeerJoin();
          this.handlers.onStatus('she is here');
          break;
        case 'peer-leave':
          this.peerPresent = false;
          this.handlers.onPeerLeave();
          this.handlers.onStatus('she stepped away');
          break;
        case 'pose':
          this.handlers.onPeerPose(message.pose);
          break;
        case 'ready':
          this.handlers.onPeerReady(message.zone);
          break;
        case 'signal':
          this.handlers.onSignal(message.data);
          break;
        case 'full':
          this.handlers.onFull();
          break;
      }
    });

    socket.addEventListener('close', () => {
      if (this.closedByUs) return;
      // A phone that locks its screen will drop the socket. Reconnecting quietly
      // matters more here than it would in a tool, because the other person is
      // standing there waiting.
      this.handlers.onStatus('reconnecting…');
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(8000, this.reconnectDelay * 2);
    });
  }

  /** Called every frame; internally rate-limited and change-gated. */
  sendPose(dt: number, pose: Pose): void {
    this.sinceLastPose += dt;
    if (this.sinceLastPose < 1 / POSE_HZ) return;

    const moved =
      Math.abs(pose.x - this.lastSent.x) > 0.01 ||
      Math.abs(pose.z - this.lastSent.z) > 0.01 ||
      Math.abs(pose.ry - this.lastSent.ry) > 0.02;
    if (!moved) return;

    this.sinceLastPose = 0;
    this.lastSent = pose;
    this.send({ t: 'pose', pose });
  }

  announceReady(zone: string): void {
    this.send({ t: 'ready', zone });
  }

  signal(data: unknown): void {
    this.send({ t: 'signal', data });
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encode(message));
  }

  dispose(): void {
    this.closedByUs = true;
    this.socket?.close();
    this.socket = null;
  }
}
