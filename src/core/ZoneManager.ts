import type { CarriedState, Zone, ZoneContext } from './Zone';

export type ZoneFactory = () => Zone;

type Phase = 'idle' | 'active' | 'preloading-next' | 'transitioning';

export interface TransitionReport {
  readonly from: string;
  readonly to: string;
  /** Milliseconds the passage took, preload included. */
  readonly ms: number;
}

/**
 * Runs the sequence of discrete spaces.
 *
 * Only one zone is resident. The next zone preloads while the current one is
 * still rendering, so a transition is a passage rather than a loading screen.
 *
 * See .kiro/steering/concept.md -> "Zone architecture".
 */
export class ZoneManager {
  private readonly factories: readonly ZoneFactory[];
  private readonly ctx: ZoneContext;

  private index = -1;
  private current: Zone | null = null;
  private next: Zone | null = null;
  private nextReady = false;
  private phase: Phase = 'idle';

  private carried: CarriedState = {
    motesFound: [],
    songProgress: 0,
    walkedTogether: false,
  };

  /** Both participants must be ready before a transition fires. */
  private localReady = false;
  private remoteReady = false;

  onZoneChange?: (zone: Zone) => void;
  onTransition?: (report: TransitionReport) => void;
  /** Raised when the local side becomes ready, so the net layer can announce it. */
  onLocalReady?: (zoneId: string) => void;

  constructor(factories: readonly ZoneFactory[], ctx: ZoneContext) {
    this.factories = factories;
    this.ctx = ctx;
  }

  get activeZone(): Zone | null {
    return this.current;
  }

  async start(): Promise<void> {
    await this.advance();
  }

  /**
   * The remote participant reports readiness to leave. Nobody drags the other
   * forward and nobody is left standing in a space that is being disposed.
   */
  setRemoteReady(ready: boolean): void {
    this.remoteReady = ready;
  }

  update(dt: number, elapsed: number): void {
    if (!this.current) return;
    this.current.update(dt, elapsed);

    if (this.phase === 'active' && this.current.isComplete()) {
      if (!this.localReady) {
        this.localReady = true;
        this.onLocalReady?.(this.current.params.id);
      }
      // Begin fetching the next space while this one is still on screen.
      this.phase = 'preloading-next';
      void this.beginPreload();
    }

    if (this.phase === 'preloading-next' && this.nextReady && this.bothReady()) {
      void this.advance();
    }
  }

  private bothReady(): boolean {
    return this.localReady && this.remoteReady;
  }

  private async beginPreload(): Promise<void> {
    const factory = this.factories[this.index + 1];
    if (!factory) {
      this.nextReady = true;
      return;
    }
    const zone = factory();
    this.next = zone;
    await zone.preload(this.ctx);
    this.nextReady = true;
  }

  private async advance(): Promise<void> {
    const startedAt = performance.now();
    const fromId = this.current?.params.id ?? 'nowhere';
    this.phase = 'transitioning';

    if (this.current) {
      Object.assign(this.carried, this.current.exit());
      this.current.dispose();
      this.current = null;
    }

    let zone = this.next;
    this.next = null;
    this.nextReady = false;

    if (!zone) {
      const factory = this.factories[this.index + 1];
      if (!factory) {
        this.phase = 'idle';
        return;
      }
      zone = factory();
      await zone.preload(this.ctx);
    }

    this.index += 1;
    this.current = zone;
    this.localReady = false;
    this.remoteReady = false;

    // A hard cut into a new space snaps exposure rather than adapting, so the
    // first frame of a zone is already correctly exposed.
    this.ctx.grade.snapTo(zone.params.exposure);
    this.ctx.grade.applyTo(this.ctx.scene, zone.params.environmentIntensity);

    zone.enter(this.ctx, this.carried);
    this.phase = 'active';

    this.onZoneChange?.(zone);
    this.onTransition?.({
      from: fromId,
      to: zone.params.id,
      ms: Math.round(performance.now() - startedAt),
    });
  }

  dispose(): void {
    this.current?.dispose();
    this.next?.dispose();
    this.current = null;
    this.next = null;
    this.phase = 'idle';
  }
}
