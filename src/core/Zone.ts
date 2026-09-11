import type { Camera, Scene } from 'three/webgpu';
import type { OccasionPreset } from '@/occasions/presets';
import type { Grade } from './Grade';
import type { TierBudget } from './Tier';
import type { Character } from '@/characters/Character';

/**
 * Zone parameters are DATA. Never hardcode these inside a zone, and never branch
 * on occasion type — an occasion preset overlays dressing onto these values.
 *
 * See .kiro/steering/concept.md -> "Zone architecture" and
 * "One architecture, many occasions".
 */
export interface ZoneParams {
  readonly id: ZoneId;
  /** Human-facing name, used in status copy only. */
  readonly title: string;
  /** Sun elevation and azimuth in degrees. Drives the whole mood of a space. */
  readonly sunElevation: number;
  readonly sunAzimuth: number;
  /** Linear-space sun colour. */
  readonly sunColor: number;
  readonly sunIntensity: number;
  /** Sky/ambient fill. */
  readonly skyColor: number;
  readonly groundColor: number;
  readonly ambientIntensity: number;
  /** Exposure this zone asks the Grade for. The Grade owns how it gets there. */
  readonly exposure: number;
  readonly environmentIntensity: number;
  /** Distance fog, in metres. */
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  /** How far from origin a character may wander, in metres. */
  readonly bounds: number;
}

export type ZoneId = 'gate' | 'garden' | 'cafe' | 'reel' | 'shore' | 'celebration';

export interface ZoneContext {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly grade: Grade;
  readonly tier: TierBudget;
  readonly occasion: OccasionPreset;
  /** Both characters. Persistent across zones — they are continuity. */
  readonly characters: readonly Character[];
  /**
   * True when there is no room service and therefore no second person.
   *
   * A development affordance, not a product mode — the product is two people. It
   * exists so rendering work is not blocked on the backend being up, and so a
   * missing worker degrades to a walkable garden instead of a dead screen. Zones
   * may use it to make two-key mechanics exercisable alone.
   */
  readonly solo: boolean;
}

/**
 * State handed forward from one space to the next.
 *
 * With five discrete spaces rather than one continuous world, accumulated state
 * is a large part of what stops the sequence feeling like five unrelated demos.
 * Each zone should show some evidence of the ones before it.
 */
export interface CarriedState {
  /** Indices of memory motes found in the Garden, in the order found. */
  motesFound: number[];
  /** Normalised 0..1 progress through the uploaded song when the zone ended. */
  songProgress: number;
  /** Whether the pair has ever been separated for long enough to matter. */
  walkedTogether: boolean;
}

/**
 * Every space implements this identical lifecycle. One zone is resident at a
 * time, which is why the GPU texture ceiling applies per zone rather than
 * cumulatively — and why `dispose` is not optional.
 */
export interface Zone {
  readonly params: ZoneParams;

  /**
   * Fetch and decode assets. Runs while the PREVIOUS zone is still on screen so
   * a transition is never a loading screen.
   */
  preload(ctx: ZoneContext): Promise<void>;

  /** Build the space and place both characters. Receives accumulated state. */
  enter(ctx: ZoneContext, carried: CarriedState): void;

  update(dt: number, elapsed: number): void;

  /** This zone's own completion condition. Most are two-key by design. */
  isComplete(): boolean;

  /** Hand back state that must persist forward. */
  exit(): Partial<CarriedState>;

  /**
   * Release geometry, textures and render targets. A leak accumulating across
   * five transitions is the most likely way this crashes on a mid-range phone,
   * so this must actually free everything.
   */
  dispose(): void;
}
