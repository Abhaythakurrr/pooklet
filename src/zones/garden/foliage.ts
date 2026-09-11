import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import {
  clamp,
  color,
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
 * Trees and flowers.
 *
 * Trees exist for depth and enclosure. A garden with nothing above eye level
 * reads as a field, and the horizon was doing all the framing work before.
 *
 * These are canopy-blob trees rather than the full growth-hierarchy system in the
 * vegetation skill. That system builds branch topology from a species table with
 * per-level budgets and is the right answer for a hero tree you walk up to —
 * these are mid-to-background silhouettes at 10m+, where blob canopies with
 * noise-driven colour hold up and cost a fraction of the vertices. If a tree ever
 * needs to be approached closely, build that one properly.
 */

const CANOPY_GREEN = 0x4e6b33;
const CANOPY_LIGHT = 0x86a850;
/** Underside of the crown, where the canopy shades itself. */
const CANOPY_SHADOW = 0x1e2c16;
const BARK = 0x4a3b2e;

function canopyMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    roughness: 0.85,
    metalness: 0,
    // Two-sided so canopy silhouettes stay solid from any angle.
    side: DoubleSide,
  });

  // Break the blob surface up with noise so it does not read as a smooth ball.
  const grain = mx_noise_float(positionWorld.mul(1.6)).mul(0.5).add(0.5);
  const broad = mx_noise_float(positionWorld.mul(0.35)).mul(0.5).add(0.5);
  const leafy = mix(
    color(CANOPY_GREEN),
    color(CANOPY_LIGHT),
    grain.mul(0.55).add(broad.mul(0.45)),
  );

  // Vertical occlusion: real canopies are much darker underneath, where the crown
  // shades itself. Without this the blobs light evenly and read as plastic balls,
  // which was the dominant "cartoon tree" tell.
  const canopyBase = 3.0;
  const canopySpan = 4.5;
  const heightT = clamp(positionWorld.y.sub(canopyBase).div(canopySpan), 0, 1);
  const shaded = mix(color(CANOPY_SHADOW), leafy, pow(heightT, 0.7));

  // Fine displacement so the silhouette is ragged rather than a clean arc. Applied
  // along the surface normal, which is why the geometry keeps its volume.
  material.colorNode = shaded;

  // Whole-canopy sway. Distinct from the grass's rooted bend: a tree crown moves
  // as a mass, and the trunk holds it in place.
  const sway = sin(time.mul(0.55).add(positionWorld.x.mul(0.12))).mul(0.035);
  material.positionNode = vec3(
    positionLocal.x.add(sway),
    positionLocal.y,
    positionLocal.z.add(sway.mul(0.6)),
  );

  return material;
}

/**
 * A tapered, slightly leaning trunk with a few canopy masses.
 * Returns a Group so the whole tree can be placed and disposed as one unit.
 */
function createTree(height: number, lean: number, seed: number): Group {
  const tree = new Group();

  const trunkMat = new MeshStandardNodeMaterial({
    roughness: 0.92,
    metalness: 0,
  });
  const barkGrain = mx_noise_float(positionWorld.mul(vec3(6, 1.2, 6))).mul(0.5).add(0.5);
  trunkMat.colorNode = mix(color(BARK), color(0x6b5742), barkGrain.mul(0.6));

  // Tapered: real trunks are much wider at the base than under the crown.
  const trunk = new Mesh(
    new CylinderGeometry(height * 0.028, height * 0.062, height, 7, 1),
    trunkMat,
  );
  trunk.position.y = height * 0.5;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  tree.add(trunk);

  const canopyMat = canopyMaterial();

  // More, smaller, more varied masses. Four evenly-sized blobs produced a smooth
  // arc — a lollipop. Irregular clusters at irregular heights give the crown a
  // broken silhouette, which is what actually distinguishes a tree at distance.
  const blobs = 8;
  const leanOffset = Math.sin(lean) * height * 0.5;
  for (let i = 0; i < blobs; i += 1) {
    const r1 = (seed * (i + 2) * 7.31) % 1;
    const r2 = (seed * (i + 5) * 3.77) % 1;
    const r3 = (seed * (i + 11) * 5.19) % 1;

    // Wide range of masses so no two clusters match.
    const radius = height * (0.13 + r1 * 0.15);
    const blob = new Mesh(new IcosahedronGeometry(radius, 1), canopyMat);

    // Spiral placement rather than a ring, biased outward with height.
    const spreadAngle = (i / blobs) * Math.PI * 2 * 1.6 + seed * 6;
    const spread = height * (0.05 + r2 * 0.17);
    blob.position.set(
      Math.cos(spreadAngle) * spread + leanOffset,
      height * (0.7 + (i / blobs) * 0.3 + r3 * 0.08),
      Math.sin(spreadAngle) * spread,
    );

    // Independent squash and stretch per cluster, plus a random tilt so facets
    // do not line up between neighbours.
    blob.scale.set(1.0 + r2 * 0.35, 0.62 + r1 * 0.3, 1.0 + r3 * 0.35);
    blob.rotation.set(r1 * 3.1, r2 * 3.1, r3 * 3.1);
    blob.castShadow = true;
    tree.add(blob);
  }

  return tree;
}

export class TreeRing {
  readonly group = new Group();
  private readonly materials: MeshStandardNodeMaterial[] = [];

  /** Trees ringed around the clearing, denser toward the back. */
  constructor(count: number, innerRadius: number, outerRadius: number) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const height = 4.2 + Math.random() * 3.4;
      const tree = createTree(height, (Math.random() - 0.5) * 0.11, Math.random());
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(tree);

      tree.traverse((node) => {
        if (node instanceof Mesh) {
          const material = node.material as MeshStandardNodeMaterial;
          if (!this.materials.includes(material)) this.materials.push(material);
        }
      });
    }
  }

  dispose(): void {
    this.group.traverse((node) => {
      if (node instanceof Mesh) node.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
  }
}

/**
 * A flower: a thin stem and a small fan of petals.
 *
 * Built as one geometry and instanced. Petals are separate quads rather than a
 * disc so the head keeps a silhouette from the side, which is where most of them
 * are seen from.
 */
function createFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Must sit just above the grass, not tower over it. At 0.3m against 0.15m blades
  // these read as dandelions on poles rather than as flowers in a lawn.
  const stemHeight = 0.14;

  // Stem as a narrow upright quad.
  const stemHalf = 0.005;
  const stemBase = positions.length / 3;
  positions.push(-stemHalf, 0, 0, stemHalf, 0, 0, -stemHalf, stemHeight, 0, stemHalf, stemHeight, 0);
  for (let i = 0; i < 4; i += 1) normals.push(0, 0.3, 1);
  uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
  indices.push(stemBase, stemBase + 1, stemBase + 2, stemBase + 1, stemBase + 3, stemBase + 2);

  // Petals fanned around the top of the stem, tilted upward.
  const petals = 5;
  const petalLength = 0.032;
  const petalWidth = 0.017;
  for (let p = 0; p < petals; p += 1) {
    const angle = (p / petals) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sinA = Math.sin(angle);
    const base = positions.length / 3;
    const tilt = 0.028;

    // Quad from the head centre outward.
    positions.push(0, stemHeight, 0);
    positions.push(cos * petalLength * 0.55 - sinA * petalWidth, stemHeight + tilt * 0.6, sinA * petalLength * 0.55 + cos * petalWidth);
    positions.push(cos * petalLength, stemHeight + tilt, sinA * petalLength);
    positions.push(cos * petalLength * 0.55 + sinA * petalWidth, stemHeight + tilt * 0.6, sinA * petalLength * 0.55 - cos * petalWidth);

    for (let i = 0; i < 4; i += 1) normals.push(0, 1, 0);
    uvs.push(0.5, 0, 0, 0.5, 0.5, 1, 1, 0.5);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export class FlowerField {
  readonly mesh: InstancedMesh;

  /**
   * @param accent    occasion accent colour — flowers are where the occasion
   *                  preset becomes visible in the world
   * @param accentAlt secondary bloom colour
   */
  constructor(count: number, extent: number, clearRadius: number, accent: number, accentAlt: number) {
    const geometry = createFlowerGeometry();

    const material = new MeshStandardNodeMaterial({
      side: DoubleSide,
      roughness: 0.6,
      metalness: 0,
    });

    const seed = hash(instanceIndex);
    const stemHeight = 0.14;
    const headMask = clamp(positionLocal.y.sub(stemHeight * 0.82).mul(40), 0, 1);
    // Stems green, heads in the occasion's colours, mixed per instance.
    const petal = mix(color(accent), color(accentAlt), seed);
    material.colorNode = mix(color(0x5e7a3c), petal, headMask);

    // Nod in the wind, hinged at the base like the grass.
    const bladeT = clamp(positionLocal.y.div(stemHeight), 0, 1);
    const nod = sin(time.mul(1.2).add(seed.mul(6.2832))).mul(pow(bladeT, 1.8)).mul(0.05);
    material.positionNode = vec3(
      positionLocal.x.add(nod),
      positionLocal.y,
      positionLocal.z.add(nod.mul(0.5)),
    );

    const mesh = new InstancedMesh(geometry, material, count);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    const outer = extent * 0.5;

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(
        clearRadius * clearRadius + Math.random() * (outer * outer - clearRadius * clearRadius),
      );
      position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      quaternion.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      const s = 0.75 + Math.random() * 0.7;
      scale.set(s, s, s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    this.mesh = mesh;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardNodeMaterial).dispose();
    this.mesh.dispose();
  }
}
