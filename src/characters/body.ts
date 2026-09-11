import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  SphereGeometry,
  Vector2,
} from 'three/webgpu';

/**
 * Bride and groom bodies.
 *
 * Garments are built with `LatheGeometry` from an explicit silhouette profile,
 * because silhouette is what makes clothing read as clothing. A capsule cannot be
 * a dress at any resolution — the flare from waist to hem is the whole signal.
 *
 * Proportioned to a 1.70m figure with a real joint chain (hips, chest, neck,
 * head), so the procedural life layer drives an anatomy rather than a blob.
 *
 * Still procedural, and still not a substitute for an authored character: hair is
 * a shaped mass rather than strands, and there are no facial blendshapes. Those
 * arrive with the Character Creator mesh. What is final here is the rig layout and
 * the eye construction, which is where perceived realism actually comes from.
 *
 * See .kiro/steering/concept.md -> "Avatar realism".
 */

export type Role = 'bride' | 'groom';

export interface BodyRig {
  readonly root: Group;
  /** Sways for weight shift. */
  readonly hips: Group;
  /** Rises and swells for breath. */
  readonly chest: Group;
  /** Turns for gaze. */
  readonly head: Group;
  readonly leftEye: Group;
  readonly rightEye: Group;
  /** Where another character looks to meet this one's eyes. */
  readonly eyeAnchor: Object3D;
  /** Everything needing explicit release on zone teardown. */
  readonly materials: readonly (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[];
}

/** Skeleton heights in metres, for a 1.70m figure. */
const HIP_Y = 0.92;
const WAIST_Y = 1.0;
const SHOULDER_Y = 1.4;
const HEAD_Y = 1.57;

function skinMaterial(tone: number): MeshPhysicalNodeMaterial {
  // Physical for `sheen`, which gives skin a faint soft falloff at grazing angles.
  // A stand-in for subsurface scattering until the real SSS pass lands — without
  // something in this slot skin reads as plastic.
  return new MeshPhysicalNodeMaterial({
    color: tone,
    roughness: 0.52,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new Color(0xff9d86),
  });
}

function clothMaterial(hex: number, roughness: number, sheen: number): MeshPhysicalNodeMaterial {
  return new MeshPhysicalNodeMaterial({
    color: hex,
    roughness,
    metalness: 0,
    sheen,
    sheenRoughness: 0.5,
  });
}

/**
 * An eye as three parts: sclera, iris, and a specular highlight.
 *
 * Eyes are tier 1 of the realism hierarchy — the research is explicit that faces
 * pass as real until the eye region is examined. The highlight is the cheapest
 * single detail in the whole project and the one that most reads as alive; a
 * matte eye looks dead regardless of everything around it.
 */
function createEye(
  materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[],
  irisHex: number,
): Group {
  const eye = new Group();

  const scleraMat = new MeshPhysicalNodeMaterial({
    color: 0xf2ece6,
    roughness: 0.075,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  materials.push(scleraMat);
  const sclera = new Mesh(new SphereGeometry(0.0125, 16, 12), scleraMat);
  eye.add(sclera);

  const irisMat = new MeshStandardNodeMaterial({
    color: irisHex,
    roughness: 0.12,
    metalness: 0,
  });
  materials.push(irisMat);
  // Slightly proud of the sclera so it never z-fights and reads with depth.
  const iris = new Mesh(new SphereGeometry(0.0062, 14, 10), irisMat);
  iris.position.z = 0.0086;
  iris.scale.set(1, 1, 0.5);
  eye.add(iris);

  const pupilMat = new MeshStandardNodeMaterial({ color: 0x120d0c, roughness: 0.2 });
  materials.push(pupilMat);
  const pupil = new Mesh(new SphereGeometry(0.0028, 10, 8), pupilMat);
  pupil.position.z = 0.0114;
  pupil.scale.set(1, 1, 0.4);
  eye.add(pupil);

  const glintMat = new MeshStandardNodeMaterial({
    color: 0xffffff,
    emissive: new Color(0xffffff),
    emissiveIntensity: 1.4,
    roughness: 1,
  });
  materials.push(glintMat);
  const glint = new Mesh(new SphereGeometry(0.0022, 8, 6), glintMat);
  glint.position.set(0.0042, 0.005, 0.0112);
  eye.add(glint);

  return eye;
}

function createHead(
  materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[],
  skinTone: number,
  hairHex: number,
  role: Role,
): { head: Group; leftEye: Group; rightEye: Group; eyeAnchor: Object3D } {
  const head = new Group();
  const skin = skinMaterial(skinTone);
  materials.push(skin);

  // Skull, squashed slightly front-to-back as real heads are.
  const skull = new Mesh(new SphereGeometry(0.093, 24, 20), skin);
  skull.scale.set(1, 1.16, 0.94);
  skull.castShadow = true;
  head.add(skull);

  // Jaw and chin, so the profile is not a ball.
  const jaw = new Mesh(new SphereGeometry(0.068, 18, 14), skin);
  jaw.position.set(0, -0.062, 0.014);
  jaw.scale.set(0.94, 0.78, 1.02);
  head.add(jaw);

  // Nose — small, but its absence is very noticeable in profile.
  const nose = new Mesh(new SphereGeometry(0.017, 10, 8), skin);
  nose.position.set(0, -0.012, 0.088);
  nose.scale.set(0.8, 1.25, 1.3);
  head.add(nose);

  const eyeZ = 0.073;
  const eyeYOffset = 0.012;
  const leftEye = createEye(materials, role === 'bride' ? 0x6a4a2d : 0x3f5a44);
  const rightEye = createEye(materials, role === 'bride' ? 0x6a4a2d : 0x3f5a44);
  leftEye.position.set(0.031, eyeYOffset, eyeZ);
  rightEye.position.set(-0.031, eyeYOffset, eyeZ);
  head.add(leftEye, rightEye);

  const eyeAnchor = new Object3D();
  eyeAnchor.position.set(0, eyeYOffset, eyeZ);
  head.add(eyeAnchor);

  // Hair as a shaped mass. Strand cards are the correct answer and the documented
  // weak point of every parametric generator; this is honest placeholder volume.
  const hairMat = clothMaterial(hairHex, 0.62, 0.5);
  materials.push(hairMat);

  const cap = new Mesh(new SphereGeometry(0.1, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  cap.position.y = 0.012;
  cap.scale.set(1.04, 1.14, 1.02);
  head.add(cap);

  if (role === 'bride') {
    // Gathered bun at the nape — reads feminine in silhouette from behind.
    const bun = new Mesh(new SphereGeometry(0.046, 16, 12), hairMat);
    bun.position.set(0, -0.028, -0.092);
    head.add(bun);

    // Veil: a translucent flare falling from the crown down the back.
    const veilProfile: Vector2[] = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      veilProfile.push(new Vector2(0.1 + t * 0.16, 0.03 - t * 0.55));
    }
    const veilMat = new MeshPhysicalNodeMaterial({
      color: 0xfbf7f2,
      roughness: 0.42,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      side: DoubleSide,
      sheen: 0.8,
      sheenRoughness: 0.35,
    });
    materials.push(veilMat);
    const veil = new Mesh(new LatheGeometry(veilProfile, 20, 0, Math.PI * 1.25), veilMat);
    veil.rotation.y = Math.PI * 0.375;
    head.add(veil);
  } else {
    // Short back and sides: a slightly tighter, lower cap.
    const sides = new Mesh(
      new SphereGeometry(0.097, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.44),
      hairMat,
    );
    sides.position.y = -0.005;
    sides.scale.set(1.03, 0.9, 1.02);
    head.add(sides);
  }

  return { head, leftEye, rightEye, eyeAnchor };
}

function addArms(
  parent: Group,
  materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[],
  sleeveMat: MeshPhysicalNodeMaterial,
  skinTone: number,
  bare: boolean,
): void {
  const skin = skinMaterial(skinTone);
  materials.push(skin);

  for (const side of [-1, 1]) {
    const arm = new Group();
    // Relative to the chest group, whose origin sits at the hips.
    arm.position.set(side * 0.185, SHOULDER_Y - HIP_Y - 0.04, 0);
    // Arms hang with a slight outward flare, not flat against the body.
    arm.rotation.z = side * 0.14;

    const upperMat = bare ? skin : sleeveMat;
    const upper = new Mesh(new CapsuleGeometry(0.042, 0.2, 3, 10), upperMat);
    upper.position.y = -0.13;
    upper.castShadow = true;
    arm.add(upper);

    const lower = new Mesh(new CapsuleGeometry(0.036, 0.19, 3, 10), bare ? skin : sleeveMat);
    lower.position.y = -0.34;
    arm.add(lower);

    const hand = new Mesh(new SphereGeometry(0.042, 12, 10), skin);
    hand.position.y = -0.47;
    hand.scale.set(0.78, 1.18, 0.56);
    arm.add(hand);

    parent.add(arm);
  }
}

function buildBride(
  materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[],
  skinTone: number,
): BodyRig {
  const root = new Group();
  const hips = new Group();
  const chest = new Group();
  root.add(hips);
  hips.add(chest);
  // Chest group sits at hip height; everything above is expressed relative to it.
  chest.position.y = HIP_Y;

  const gown = clothMaterial(0xf7f2ea, 0.46, 0.95);
  materials.push(gown);

  // Skirt: the defining silhouette. Flares from a fitted waist to a wide hem.
  const skirtProfile: Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // Cubic flare so it hugs the hip then opens out, rather than being a cone.
    const radius = 0.135 + Math.pow(t, 2.1) * 0.33;
    const y = -(WAIST_Y - 0.02) * t;
    skirtProfile.push(new Vector2(radius, y));
  }
  const skirt = new Mesh(new LatheGeometry(skirtProfile, 32), gown);
  skirt.position.y = WAIST_Y - HIP_Y;
  skirt.castShadow = true;
  // Two-sided: the hem is visible from below and from inside at low angles.
  (skirt.material as MeshPhysicalNodeMaterial).side = DoubleSide;
  chest.add(skirt);

  // Fitted bodice from waist to shoulders.
  const bodiceProfile: Vector2[] = [
    new Vector2(0.134, 0),
    new Vector2(0.128, 0.09),
    new Vector2(0.139, 0.19),
    new Vector2(0.144, 0.27),
    new Vector2(0.128, 0.35),
    new Vector2(0.096, 0.4),
  ];
  const bodice = new Mesh(new LatheGeometry(bodiceProfile, 28), gown);
  bodice.position.y = WAIST_Y - HIP_Y;
  bodice.castShadow = true;
  chest.add(bodice);

  const skin = skinMaterial(skinTone);
  materials.push(skin);

  // Shoulders and neck, so the head is connected rather than floating.
  const shoulders = new Mesh(new CapsuleGeometry(0.055, 0.2, 3, 12), skin);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = SHOULDER_Y - HIP_Y;
  chest.add(shoulders);

  const neck = new Mesh(new CapsuleGeometry(0.036, 0.055, 3, 10), skin);
  neck.position.y = SHOULDER_Y - HIP_Y + 0.055;
  chest.add(neck);

  addArms(chest, materials, gown, skinTone, true);

  const { head, leftEye, rightEye, eyeAnchor } = createHead(materials, skinTone, 0x2e1d16, 'bride');
  head.position.y = HEAD_Y - HIP_Y;
  chest.add(head);

  return { root, hips, chest, head, leftEye, rightEye, eyeAnchor, materials };
}

function buildGroom(
  materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[],
  skinTone: number,
): BodyRig {
  const root = new Group();
  const hips = new Group();
  const chest = new Group();
  root.add(hips);
  hips.add(chest);
  chest.position.y = HIP_Y;

  const suit = clothMaterial(0x2b3040, 0.66, 0.35);
  materials.push(suit);
  const shirt = clothMaterial(0xf4f1ec, 0.5, 0.6);
  materials.push(shirt);

  // Trousers: two tapered legs, so there is a gap and a silhouette.
  for (const side of [-1, 1]) {
    const leg = new Mesh(new CapsuleGeometry(0.062, 0.68, 3, 12), suit);
    leg.position.set(side * 0.068, -(HIP_Y - 0.44), 0);
    leg.castShadow = true;
    chest.add(leg);

    const shoe = new Mesh(new BoxGeometry(0.085, 0.045, 0.2), suit);
    shoe.position.set(side * 0.068, -HIP_Y + 0.022, 0.03);
    chest.add(shoe);
  }

  // Jacket: squarer than the gown, with a slight waist and a small skirt.
  const jacketProfile: Vector2[] = [
    new Vector2(0.148, -0.14),
    new Vector2(0.152, -0.05),
    new Vector2(0.146, 0.06),
    new Vector2(0.155, 0.18),
    new Vector2(0.163, 0.28),
    new Vector2(0.142, 0.37),
    new Vector2(0.105, 0.41),
  ];
  const jacket = new Mesh(new LatheGeometry(jacketProfile, 26), suit);
  jacket.position.y = 0.02;
  jacket.castShadow = true;
  chest.add(jacket);

  // Shirt front showing between the lapels — a narrow panel, proud of the jacket.
  const front = new Mesh(new BoxGeometry(0.075, 0.32, 0.03), shirt);
  front.position.set(0, 0.24, 0.142);
  chest.add(front);

  const tie = clothMaterial(0x7d2f3a, 0.58, 0.4);
  materials.push(tie);
  const tieMesh = new Mesh(new BoxGeometry(0.032, 0.2, 0.016), tie);
  tieMesh.position.set(0, 0.24, 0.161);
  chest.add(tieMesh);

  const skin = skinMaterial(skinTone);
  materials.push(skin);

  const shoulders = new Mesh(new CapsuleGeometry(0.06, 0.24, 3, 12), suit);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = SHOULDER_Y - HIP_Y;
  chest.add(shoulders);

  const neck = new Mesh(new CapsuleGeometry(0.04, 0.06, 3, 10), skin);
  neck.position.y = SHOULDER_Y - HIP_Y + 0.05;
  chest.add(neck);

  addArms(chest, materials, suit, skinTone, false);

  const { head, leftEye, rightEye, eyeAnchor } = createHead(materials, skinTone, 0x1f1512, 'groom');
  head.position.y = HEAD_Y - HIP_Y;
  chest.add(head);

  return { root, hips, chest, head, leftEye, rightEye, eyeAnchor, materials };
}

export function buildBody(role: Role, skinTone: number): BodyRig {
  const materials: (MeshStandardNodeMaterial | MeshPhysicalNodeMaterial)[] = [];
  return role === 'bride' ? buildBride(materials, skinTone) : buildGroom(materials, skinTone);
}
