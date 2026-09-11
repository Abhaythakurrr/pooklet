import {
  ACESFilmicToneMapping,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';

/**
 * THE single owner of tone mapping, exposure and output colour.
 *
 * Five separate spaces have to read as one loving world. Per-zone grading is
 * what makes an anthology feel like five unrelated demos, so no zone is allowed
 * to touch `renderer.toneMapping` or `toneMappingExposure` directly. Zones
 * differentiate through time of day, material palette and content — never
 * through their own colour pipeline.
 *
 * See .kiro/steering/concept.md -> "Visual coherence".
 */
export class Grade {
  private readonly renderer: WebGPURenderer;

  /** Exposure the grade settles to. Zones may request a target, not set it. */
  private targetExposure = 1;
  private currentExposure = 1;

  /** Seconds for exposure to travel most of the way to a new target. */
  private adaptationUp = 1.8;
  private adaptationDown = 0.8;

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;

    // Set once, here, and nowhere else in the codebase.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.currentExposure;
  }

  /**
   * A zone asks for an exposure; the grade decides how to get there. Asymmetric
   * adaptation because the eye darkens faster than it brightens, and matching
   * that reads as natural.
   */
  requestExposure(value: number): void {
    this.targetExposure = Math.max(0.05, value);
  }

  update(dt: number): void {
    const brightening = this.targetExposure > this.currentExposure;
    const tau = brightening ? this.adaptationUp : this.adaptationDown;
    // Frame-rate independent exponential approach.
    const k = 1 - Math.exp(-dt / tau);
    this.currentExposure += (this.targetExposure - this.currentExposure) * k;
    this.renderer.toneMappingExposure = this.currentExposure;
  }

  /** Snap without adaptation. Use on a hard cut into a new zone, not mid-zone. */
  snapTo(value: number): void {
    this.targetExposure = Math.max(0.05, value);
    this.currentExposure = this.targetExposure;
    this.renderer.toneMappingExposure = this.currentExposure;
  }

  /**
   * Applied to every zone's scene so background and lighting share one
   * environment intensity convention.
   */
  applyTo(scene: Scene, environmentIntensity: number): void {
    scene.environmentIntensity = environmentIntensity;
  }

  get exposure(): number {
    return this.currentExposure;
  }
}
