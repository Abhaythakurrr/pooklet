import {
  BackSide,
  Mesh,
  MeshBasicNodeMaterial,
  SphereGeometry,
} from 'three/webgpu';
import { color, mix, positionLocal, smoothstep } from 'three/tsl';

/**
 * A gradient sky.
 *
 * Without one the world sits in a black void, which the first render made
 * obvious: lit foliage floating in nothing. A dome is deliberately chosen over a
 * solid background colour because the horizon-to-zenith gradient is most of what
 * sells outdoor light, and it costs one unlit draw call.
 *
 * Not an HDRI yet. When Poly Haven HDRIs land (CC0, 1-2K, UltraHDR gainmap) this
 * becomes the fallback for the mobile tier.
 */
export class SkyDome {
  readonly mesh: Mesh;

  constructor(horizon: number, zenith: number, radius = 90) {
    const geometry = new SphereGeometry(radius, 24, 16);

    const material = new MeshBasicNodeMaterial({
      side: BackSide,
      // The sky must never occlude or be fogged like real geometry.
      fog: false,
      depthWrite: false,
    });

    // Height through the dome, remapped so the gradient sits mostly above the
    // horizon rather than being spread over the whole sphere.
    const height = positionLocal.y.div(radius);
    const t = smoothstep(-0.05, 0.55, height);
    // sRGB hex direct — `color()` handles the conversion. Converting first
    // double-converts and darkens everything.
    material.colorNode = mix(color(horizon), color(zenith), t);

    this.mesh = new Mesh(geometry, material);
    // Render first, so it never z-fights with distant geometry.
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
  }
}
