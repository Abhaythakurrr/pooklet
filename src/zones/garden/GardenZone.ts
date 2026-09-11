import {
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three/webgpu';
import { color, float, min, mix, mx_noise_float, positionWorld, smoothstep, texture, uv } from 'three/tsl';
import type { CarriedState, Zone, ZoneContext, ZoneParams } from '@/core/Zone';
import { disposeSubtree } from '@/core/dispose';
import { FlowerField, TreeRing } from './foliage';
import { GrassField } from './grass';
import { SkyDome } from './SkyDome';
import { TrailMap } from './TrailMap';
import { BLOOM_TARGET, GARDEN_EXTENT, GRASS_EXTENT } from './params';

const MOTE_COUNT = 5;
/** How close both characters must be to a mote for it to count as found. */
const MOTE_REACH = 2.4;
/** Keep the middle walkable and unplanted. */
const CLEAR_RADIUS = 3.4;

/**
 * The Garden. First space, and the one that locks the contracts.
 *
 * Built first on purpose: this is where the grading, the audio signature and the
 * two-person mechanics get settled, and every later space inherits them.
 *
 * See .kiro/steering/concept.md -> "2. The Garden".
 */
export class GardenZone implements Zone {
  readonly params: ZoneParams;

  private readonly root = new Group();
  private trail!: TrailMap;
  private ground: Mesh | null = null;
  private grass: GrassField | null = null;
  private trees: TreeRing | null = null;
  private flowers: FlowerField | null = null;
  private motes: Mesh[] = [];
  private readonly motePositions: Vector3[] = [];
  private readonly found = new Set<number>();

  private sun: DirectionalLight | null = null;
  private sky: SkyDome | null = null;
  private previousFog: Fog | null = null;

  private ctx!: ZoneContext;
  private elapsed = 0;

  private readonly accent: number;
  private readonly accentAlt: number;

  constructor(occasionAccent: number, occasionAlt: number, params: ZoneParams) {
    this.params = params;
    this.accent = occasionAccent;
    this.accentAlt = occasionAlt;
  }

  async preload(_ctx: ZoneContext): Promise<void> {
    // Still fully procedural, so nothing to fetch. When CC0 assets land (Poly
    // Haven and ambientCG only) they load here, while the previous space is still
    // on screen.
    this.trail = new TrailMap(GARDEN_EXTENT);
  }

  enter(ctx: ZoneContext, carried: CarriedState): void {
    this.ctx = ctx;
    const p = this.params;

    this.buildLight(ctx);
    this.buildGround(ctx);

    // Grass is the single biggest contributor to this reading as a garden rather
    // than a diagram, so it gets the whole foliage budget.
    //
    // Concentrated into GRASS_EXTENT rather than spread over the full ground plane:
    // coverage is instances per square metre, so spreading the same budget over 3x
    // the area just makes the whole lawn sparse. Beyond this radius the ground
    // material carries it — its turf green matches the blade roots, so distant
    // ground reads as mown grass rather than as bare earth.
    this.grass = new GrassField(ctx.tier.foliageBudget, GRASS_EXTENT, CLEAR_RADIUS, {
      root: 0x3f5a2a,
      tip: 0x86a544,
      dry: 0xa89a52,
    });
    this.root.add(this.grass.mesh);

    // Trees for enclosure and depth. Without something above eye level the space
    // reads as an open field with no sense of place.
    this.trees = new TreeRing(ctx.tier.name === 'mobile' ? 10 : 16, 14, GARDEN_EXTENT * 0.46);
    this.root.add(this.trees.group);

    // Flowers are where the occasion preset becomes visible in the world.
    this.flowers = new FlowerField(
      ctx.tier.name === 'mobile' ? 400 : 1100,
      GARDEN_EXTENT * 0.8,
      CLEAR_RADIUS,
      this.accent,
      this.accentAlt,
    );
    this.root.add(this.flowers.mesh);

    this.buildMotes(carried);

    ctx.scene.add(this.root);

    // Place the pair a little apart, facing each other, so the first thing they do
    // is close the distance.
    ctx.characters[0]?.root.position.set(-1.1, 0, 2);
    ctx.characters[1]?.root.position.set(1.1, 0, 2);
    void p;
  }

  private buildLight(ctx: ZoneContext): void {
    const p = this.params;

    const hemi = new HemisphereLight(p.skyColor, p.groundColor, p.ambientIntensity);
    this.root.add(hemi);

    const sun = new DirectionalLight(p.sunColor, p.sunIntensity);
    const elevation = (p.sunElevation * Math.PI) / 180;
    const azimuth = (p.sunAzimuth * Math.PI) / 180;
    sun.position.set(
      Math.cos(elevation) * Math.sin(azimuth) * 40,
      Math.sin(elevation) * 40,
      Math.cos(elevation) * Math.cos(azimuth) * 40,
    );
    if (ctx.tier.shadowMapSize > 0) {
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(ctx.tier.shadowMapSize);
      sun.shadow.camera.left = -p.bounds;
      sun.shadow.camera.right = p.bounds;
      sun.shadow.camera.top = p.bounds;
      sun.shadow.camera.bottom = -p.bounds;
      sun.shadow.camera.far = 90;
      sun.shadow.bias = -0.0005;
      // normalBias is the correct fix for acne on large flat receivers; plain
      // bias alone either leaves stripes or detaches contact shadows.
      sun.shadow.normalBias = 0.02;
    }
    this.sun = sun;
    this.root.add(sun);

    this.previousFog = ctx.scene.fog as Fog | null;
    ctx.scene.fog = new Fog(p.fogColor, p.fogNear, p.fogFar);

    this.sky = new SkyDome(p.fogColor, p.skyColor);
    this.root.add(this.sky.mesh);
  }

  private buildGround(ctx: ZoneContext): void {
    // Pass sRGB hex straight in. `color()` already converts into the working
    // colour space — converting first double-converts and renders near-black.
    // Warm worn earth for the clearing, and a turf green that matches the grass
    // root colour. Matching matters: where blades are sparse the ground shows
    // through, so if it is dark brown the lawn looks moth-eaten. The first pass
    // used near-black soil and the clearing read as a hole.
    const soil = color(0x6d5a3f);
    const turf = color(0x4a6b2e);
    const bloomColor = color(this.accent);
    const bloomColorAlt = color(this.accentAlt);

    // Two noise octaves so the ground has both broad patches and fine break-up.
    // A single flat albedo is what made the first pass read as a plane.
    const broad = mx_noise_float(positionWorld.xz.mul(0.045)).mul(0.5).add(0.5);
    const fine = mx_noise_float(positionWorld.xz.mul(0.42)).mul(0.5).add(0.5);
    const earth = mix(soil, turf, broad.mul(0.75).add(fine.mul(0.25)));

    const trailSample = texture(this.trail.texture, uv());
    // BOTH channels must be present. One person walking alone changes nothing.
    const together = min(trailSample.r, trailSample.g);
    const bloomMask = smoothstep(0.42, 0.62, together);
    const flower = mix(bloomColorAlt, bloomColor, smoothstep(0.55, 0.95, together));

    const groundMat = new MeshStandardNodeMaterial({ metalness: 0 });
    groundMat.colorNode = mix(earth, flower, bloomMask);
    // Bloomed ground is slightly smoother, as petals are. `float` not `color` —
    // roughness is scalar and a vec3 breaks the material.
    groundMat.roughnessNode = mix(float(0.94), float(0.66), bloomMask);

    // Subdivided so it can take vertex-level lighting variation later and so fog
    // interpolates smoothly across it.
    const groundGeo = new PlaneGeometry(GARDEN_EXTENT, GARDEN_EXTENT, 24, 24);
    groundGeo.rotateX(-Math.PI / 2);
    this.ground = new Mesh(groundGeo, groundMat);
    this.ground.receiveShadow = ctx.tier.shadowMapSize > 0;
    this.root.add(this.ground);
  }

  private buildMotes(carried: CarriedState): void {
    // Memory motes: the host's uploaded photos, seeded through the garden. Found
    // here, they carry forward and are what plays in the Reel Room.
    const geo = new SphereGeometry(0.085, 14, 12);
    const mat = new MeshStandardNodeMaterial({
      color: 0xfff4dc,
      roughness: 0.35,
    });
    mat.emissiveNode = color(0xffd9a0);

    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const angle = (i / MOTE_COUNT) * Math.PI * 2 + 0.4;
      const radius = 7 + (i % 3) * 3.5;
      const p = new Vector3(Math.cos(angle) * radius, 1.15, Math.sin(angle) * radius);
      this.motePositions.push(p);

      const mote = new Mesh(geo.clone(), mat.clone());
      mote.position.copy(p);
      this.motes.push(mote);
      this.root.add(mote);
    }

    for (const index of carried.motesFound) {
      if (index >= 0 && index < this.motes.length) {
        this.found.add(index);
        this.motes[index].visible = false;
      }
    }
  }

  update(dt: number, elapsed: number): void {
    this.elapsed = elapsed;
    const [a, b] = this.ctx.characters;

    // Mark the trail. Bloom needs both, so each participant writes their own
    // channel and the ground shader intersects them.
    if (a) this.trail.mark(a.root.position, 0);
    if (b && !this.ctx.solo) this.trail.mark(b.root.position, 1);
    if (a && this.ctx.solo) {
      // Solo is a dev affordance: write both channels from the one walker so the
      // bloom and the completion condition stay exercisable without a partner.
      this.trail.mark(a.root.position, 1);
    }
    this.trail.update(dt);

    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      if (!mote.visible) continue;
      const home = this.motePositions[i];
      mote.position.y = home.y + Math.sin(elapsed * 0.9 + i * 1.7) * 0.14;

      const nearA = a ? a.root.position.distanceTo(mote.position) < MOTE_REACH : false;
      const nearB = this.ctx.solo
        ? nearA
        : b
          ? b.root.position.distanceTo(mote.position) < MOTE_REACH
          : false;
      if (nearA && nearB) {
        this.found.add(i);
        mote.visible = false;
      }
    }

    // Characters keep looking at each other. Correct gaze outranks photorealism,
    // so this is doing more work than it looks like.
    if (a && b && !this.ctx.solo) {
      const aEye = new Vector3();
      const bEye = new Vector3();
      a.eyeAnchor.getWorldPosition(aEye);
      b.eyeAnchor.getWorldPosition(bEye);
      a.lookAt(bEye);
      b.lookAt(aEye);
    }
  }

  isComplete(): boolean {
    // Two-key by design: every mote found together, and enough of the path
    // bloomed that they demonstrably walked it side by side.
    return this.found.size >= MOTE_COUNT && this.trail.bloomed >= BLOOM_TARGET;
  }

  exit(): Partial<CarriedState> {
    return {
      motesFound: [...this.found].sort((x, y) => x - y),
      walkedTogether: this.trail.bloomed >= BLOOM_TARGET,
    };
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.scene.fog = this.previousFog;
    }
    this.sun?.shadow?.map?.dispose();
    this.sky?.dispose();
    this.sky = null;
    this.grass?.dispose();
    this.grass = null;
    this.trees?.dispose();
    this.trees = null;
    this.flowers?.dispose();
    this.flowers = null;
    this.trail?.dispose();
    disposeSubtree(this.root);
    this.motes = [];
    this.motePositions.length = 0;
    this.ground = null;
  }

  /** Exposed for the debug overlay. */
  get progress(): { motes: number; bloom: number; elapsed: number } {
    return { motes: this.found.size, bloom: this.trail?.bloomed ?? 0, elapsed: this.elapsed };
  }
}
