import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import {
  clamp,
  color,
  float,
  hash,
  instanceIndex,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  pow,
  sin,
  time,
  vec3,
} from 'three/tsl';

/**
 * Meadow grass.
 *
 * A blade is a tapered, leaning ribbon — not a cone. That distinction is most of
 * why the first pass read as a spike field: cones have a hard silhouette and no
 * tip taper, so the eye reads them as objects rather than as ground cover.
 *
 * Technique follows the stylized-meadow-grass system in the
 * threejs-procedural-vegetation skill: tapered multi-segment blades, clumped
 * placement, per-instance height and colour variation, macro colour drift across
 * the field, and rooted wind that bends from the base rather than sliding the
 * whole blade.
 *
 * Ported to TSL rather than copied: that example is a raw-GLSL ShaderMaterial,
 * which the WebGPU backend cannot compile. Per-instance variation comes from
 * `hash(instanceIndex)` instead of custom attributes, which keeps the buffers
 * small — and buffer size is the real constraint on a phone.
 */

/**
 * Blade height in metres.
 *
 * Lawn grass is ankle height. The first pass used 0.42m which, once compounded by
 * per-instance height variation and clump scale, reached roughly 0.7m — waist-high
 * on a 1.7m figure. It read as a wheat field and made the characters look like they
 * were wading. Scale against the body, not against the ground plane.
 */
const BLADE_HEIGHT = 0.15;
/** Blades per instanced clump. Clumping is how density stays affordable. */
const BLADES_PER_CLUMP = 5;

/**
 * One clump of leaning, tapered blades as a single geometry.
 *
 * Single-plane blades with `DoubleSide` rather than the reference's five
 * intersecting planes: at 20k+ blades the cross-plane version is roughly 3x the
 * vertices for detail that does not survive at grazing view angles on a phone.
 */
function createClumpGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const segments = 4;
  // Width scaled with the height so blades stay proportioned rather than becoming
  // stubby ribbons.
  const width = 0.017;

  for (let blade = 0; blade < BLADES_PER_CLUMP; blade += 1) {
    // Spread blades around the clump centre and fan their directions.
    const angle = (blade / BLADES_PER_CLUMP) * Math.PI * 2 + Math.random() * 0.8;
    const spread = 0.05 + Math.random() * 0.085;
    const originX = Math.cos(angle) * spread;
    const originZ = Math.sin(angle) * spread;
    // Blades lean outward from the clump, which is what real tussocks do.
    const leanDirX = Math.cos(angle);
    const leanDirZ = Math.sin(angle);
    const height = BLADE_HEIGHT * (0.62 + Math.random() * 0.7);
    const leanAmount = 0.1 + Math.random() * 0.16;
    const base = positions.length / 3;

    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      // Taper toward a point so the tip disappears instead of ending flat.
      const taper = Math.pow(1 - t, 1.4);
      const halfWidth = width * (0.12 + 0.88 * taper);
      // Accelerating lean gives the blade a curve rather than a straight tilt.
      const lean = Math.pow(t, 1.7) * leanAmount;
      const y = t * height;

      for (const side of [-1, 1]) {
        // Offset across the blade, perpendicular to its lean direction.
        const px = originX + leanDirX * lean + -leanDirZ * halfWidth * side;
        const pz = originZ + leanDirZ * lean + leanDirX * halfWidth * side;
        positions.push(px, y, pz);
        // Normal tilted up so grass catches sky light and reads soft.
        normals.push(leanDirX * 0.4, 0.86, leanDirZ * 0.4);
        uvs.push(side < 0 ? 0 : 1, t);
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const row = base + segment * 2;
      indices.push(row, row + 1, row + 2, row + 1, row + 3, row + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createGrassMaterial(rootHex: number, tipHex: number, dryHex: number): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    side: DoubleSide,
    roughness: 0.72,
    metalness: 0,
  });

  const seed = hash(instanceIndex);
  // Height along this blade, 0 at the root and 1 at the tip.
  const bladeT = clamp(positionLocal.y.div(BLADE_HEIGHT), 0, 1);

  // --- Rooted wind -----------------------------------------------------------
  // Bend grows with height so the base stays planted. A blade that translates
  // instead of bending is the single most obvious tell of fake grass.
  const phase = time.mul(1.45).add(seed.mul(6.2832));
  const gust = sin(phase).mul(0.5).add(0.5);
  const chop = sin(phase.mul(2.7)).mul(0.5).add(0.5);
  const strength = gust.mul(0.75).add(chop.mul(0.25));
  const bend = pow(bladeT, 1.6).mul(strength).mul(0.14);

  // Height variation per clump, so the field is not a mown carpet.
  const heightScale = seed.mul(0.55).add(0.72);

  material.positionNode = vec3(
    positionLocal.x.add(bend),
    positionLocal.y.mul(heightScale),
    positionLocal.z.add(bend.mul(0.55)),
  );

  // --- Colour ---------------------------------------------------------------
  const root = color(rootHex);
  const tip = color(tipHex);
  const dry = color(dryHex);

  // Root-to-tip gradient: grass is darker where light does not reach the base.
  const gradient = mix(root, tip, pow(bladeT, 0.8));

  // Macro drift across the meadow so large areas differ in tone. Without this
  // the field is one flat colour and reads as artificial no matter how good the
  // blade shape is.
  const macro = mx_noise_float(positionWorld.xz.mul(0.055)).mul(0.5).add(0.5);
  const patch = mix(gradient, dry, macro.mul(0.45));

  // Per-clump jitter on top of the macro variation.
  const jitter = seed.mul(0.18).sub(0.09);
  material.colorNode = patch.add(vec3(jitter, jitter.mul(1.3), jitter.mul(0.4)));

  // Tips catch more light than roots — cheap stand-in for translucency.
  material.roughnessNode = mix(float(0.86), float(0.55), bladeT);

  return material;
}

export class GrassField {
  readonly mesh: InstancedMesh;

  /**
   * @param clumps      instance count, from the tier's foliage budget
   * @param extent      field width in metres
   * @param clearRadius keep the middle walkable and unobstructed
   */
  constructor(
    clumps: number,
    extent: number,
    clearRadius: number,
    palette: { root: number; tip: number; dry: number },
  ) {
    const geometry = createClumpGeometry();
    const material = createGrassMaterial(palette.root, palette.tip, palette.dry);
    const mesh = new InstancedMesh(geometry, material, clumps);

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    const outer = extent * 0.5;

    /** How far the height ramp extends past the clearing edge, in metres. */
    const edgeRamp = 2.6;

    for (let i = 0; i < clumps; i += 1) {
      const angle = Math.random() * Math.PI * 2;

      // Wobble the clearing boundary so it is not a drawn circle. A perfect
      // radius reads as a stencil cut into the lawn, which was very visible.
      const wobble =
        1 + Math.sin(angle * 3.7) * 0.17 + Math.sin(angle * 7.3 + 1.2) * 0.1;
      const inner = clearRadius * wobble;

      // Even by area, so density does not pile up at the centre.
      const radius = Math.sqrt(inner * inner + Math.random() * (outer * outer - inner * inner));
      position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      // Only slight yaw variation. Rotating clumps freely would scatter the wind
      // direction, since the bend is applied in instance-local space.
      quaternion.setFromAxisAngle(up, (Math.random() - 0.5) * 0.9);

      // Ramp height up over the first couple of metres so grass grows into the
      // clearing instead of starting at full height against bare earth.
      const edgeT = Math.min(1, (radius - inner) / edgeRamp);
      const s = (0.8 + Math.random() * 0.45) * (0.3 + 0.7 * Math.pow(edgeT, 0.7));
      scale.set(s, s, s);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Grass neither casts nor receives real-time shadows: at this blade count it
    // would dominate the shadow pass, and the root-to-tip gradient already does
    // the job of implying self-shadowing.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    this.mesh = mesh;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardNodeMaterial).dispose();
    this.mesh.dispose();
  }
}
