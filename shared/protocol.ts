/**
 * Wire protocol between the browser and the room Durable Object.
 *
 * Shared by `src/` and `worker/` so the two cannot drift apart.
 *
 * The room is strictly two-person. That is a product decision, not a limit to be
 * relaxed later: a world built for exactly two cannot be empty, which is the
 * structural reason this can work where social VR's ghost-town failure did not.
 * See .kiro/steering/concept.md -> "Why exactly two people".
 */

export const MAX_OCCUPANTS = 2;

/** 0 is the host who made the place, 1 is the guest it was made for. */
export type Slot = 0 | 1;

export interface RoomConfig {
  /** Occasion preset id. Occasion is data, never a code branch. */
  readonly occasion: string;
  /** Who it is for, as written by the host. */
  readonly recipient: string;
  /** Object keys in R2. Absent until the host has uploaded. */
  readonly songKey?: string;
  readonly mediaKeys?: readonly string[];
}

/** Position and facing. Sent at a fixed low rate and interpolated on arrival. */
export interface Pose {
  /** Metres, world space. Y is derived from the ground, so it is not sent. */
  readonly x: number;
  readonly z: number;
  /** Body yaw in radians. */
  readonly ry: number;
}

export type ClientMessage =
  | { readonly t: 'hello' }
  | { readonly t: 'pose'; readonly pose: Pose }
  | { readonly t: 'ready'; readonly zone: string }
  /** Opaque WebRTC signalling payload, relayed verbatim to the peer. */
  | { readonly t: 'signal'; readonly data: unknown };

export type ServerMessage =
  | {
      readonly t: 'welcome';
      readonly slot: Slot;
      readonly config: RoomConfig;
      readonly peerPresent: boolean;
      /** The higher slot initiates the WebRTC offer, so both sides agree. */
      readonly shouldOffer: boolean;
    }
  | { readonly t: 'peer-join' }
  | { readonly t: 'peer-leave' }
  | { readonly t: 'pose'; readonly pose: Pose }
  | { readonly t: 'ready'; readonly zone: string }
  | { readonly t: 'signal'; readonly data: unknown }
  | { readonly t: 'full' };

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export function decodeServer(raw: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as ServerMessage;
    return typeof parsed?.t === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function decodeClient(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as ClientMessage;
    return typeof parsed?.t === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
