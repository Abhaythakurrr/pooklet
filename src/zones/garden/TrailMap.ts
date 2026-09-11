import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, type Vector3 } from 'three/webgpu';

/**
 * The path blooms only where BOTH have walked.
 *
 * Signature mechanic. Walk apart and the trail stays bare; walk together and it
 * blooms behind you. Togetherness made literal rather than incidental — this is
 * the kind of thing a generic venue product cannot do.
 *
 * Implementation is a small CPU-side texture rather than a GPU ping-pong pass,
 * deliberately: the red channel records one participant's visits and green the
 * other, and the ground shader blooms on `min(r, g)`. At 128px across a 44m
 * garden that is ~34cm per pixel, which is finer than the bloom needs, and it
 * costs a handful of byte writes per frame instead of a render target. It also
 * behaves identically on the WebGPU and WebGL2 backends, which matters because
 * mobile is the primary tier.
 *
 * See .kiro/steering/concept.md -> "Signature mechanics".
 */
export class TrailMap {
  static readonly RESOLUTION = 128;

  readonly texture: DataTexture;

  private readonly data: Uint8Array;
  private readonly extent: number;
  /** Splat radius in pixels. */
  private readonly radius = 3;

  /** Fraction of the map where both have walked. Drives zone completion. */
  private bloomedFraction = 0;
  private dirty = false;
  private sinceRecount = 0;

  constructor(extentMetres: number) {
    const n = TrailMap.RESOLUTION;
    this.extent = extentMetres;
    this.data = new Uint8Array(n * n * 4);
    // Alpha at full so the texture is not treated as transparent anywhere.
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;

    this.texture = new DataTexture(this.data, n, n, RGBAFormat, UnsignedByteType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.needsUpdate = true;
  }

  /**
   * @param who 0 for the local participant, 1 for the remote one.
   */
  mark(position: Vector3, who: 0 | 1): void {
    const n = TrailMap.RESOLUTION;
    const half = this.extent * 0.5;
    // World XZ -> texel. Outside the garden bounds is simply ignored.
    const u = (position.x + half) / this.extent;
    const v = (position.z + half) / this.extent;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;

    const cx = Math.floor(u * (n - 1));
    const cy = Math.floor(v * (n - 1));
    const channel = who === 0 ? 0 : 1;
    const r = this.radius;

    for (let dy = -r; dy <= r; dy += 1) {
      const y = cy + dy;
      if (y < 0 || y >= n) continue;
      for (let dx = -r; dx <= r; dx += 1) {
        const x = cx + dx;
        if (x < 0 || x >= n) continue;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        // Soft edge so the bloom does not look stamped.
        const falloff = 1 - d / r;
        const add = Math.round(28 * falloff * falloff);
        if (add <= 0) continue;
        const i = (y * n + x) * 4 + channel;
        this.data[i] = Math.min(255, this.data[i] + add);
        this.dirty = true;
      }
    }
  }

  update(dt: number): void {
    if (this.dirty) {
      this.texture.needsUpdate = true;
      this.dirty = false;
    }

    // Recounting every frame would be wasteful for a value that changes slowly.
    this.sinceRecount += dt;
    if (this.sinceRecount >= 0.5) {
      this.sinceRecount = 0;
      this.recount();
    }
  }

  private recount(): void {
    const n = TrailMap.RESOLUTION;
    const total = n * n;
    let bloomed = 0;
    for (let i = 0; i < total; i += 1) {
      const o = i * 4;
      // Bloom requires BOTH channels present. This is the whole point.
      if (Math.min(this.data[o], this.data[o + 1]) > 110) bloomed += 1;
    }
    this.bloomedFraction = bloomed / total;
  }

  /** 0..1. How much of the garden the two of them have bloomed together. */
  get bloomed(): number {
    return this.bloomedFraction;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
