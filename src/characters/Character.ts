import { Group, Mesh, Vector3 } from 'three/webgpu';
import { disposeSubtree } from '@/core/dispose';
import { buildBody, type BodyRig, type Role } from './body';
import { Life } from './Life';

/**
 * A participant's body.
 *
 * Geometry comes from `body.ts`; everything here is the living layer that makes it
 * read as a person — gaze, blink, breath, weight shift, and a mouth driven by the
 * real microphone.
 *
 * That split is deliberate. The rig contract and these systems are
 * character-agnostic, so swapping the procedural body for an authored Character
 * Creator mesh later changes `body.ts` and nothing else.
 *
 * See .kiro/steering/concept.md -> "Avatar realism".
 */
export class Character {
  readonly root = new Group();
  readonly life = new Life();
  readonly isLocal: boolean;
  readonly role: Role;

  private readonly rig: BodyRig;
  private readonly gazeTarget = new Vector3();
  private hasGazeTarget = false;

  /** Scratch vector, reused so the update loop allocates nothing. */
  private readonly tmpLocal = new Vector3();

  /** Baseline transforms, so the life layer offsets rather than overwrites. */
  private readonly chestRestY: number;

  constructor(isLocal: boolean, role: Role, skinTone: number) {
    this.isLocal = isLocal;
    this.role = role;
    this.rig = buildBody(role, skinTone);
    this.root.add(this.rig.root);
    this.chestRestY = this.rig.chest.position.y;

    // Cast shadows from every solid part. A figure with no contact shadow floats,
    // and grounding is most of what makes a body feel physically present.
    // Transparent parts are excluded — the veil would cast a hard opaque blob.
    this.rig.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const material = node.material as { transparent?: boolean } | undefined;
      node.castShadow = !material?.transparent;
    });
  }

  /** Where another character should look to meet this one's eyes. */
  get eyeAnchor() {
    return this.rig.eyeAnchor;
  }

  /** Look at a world-space point. Pass the other character's eye anchor. */
  lookAt(worldPoint: Vector3): void {
    this.gazeTarget.copy(worldPoint);
    this.hasGazeTarget = true;
  }

  clearGaze(): void {
    this.hasGazeTarget = false;
  }

  setVoiceAmplitude(amplitude: number): void {
    this.life.setVoiceAmplitude(amplitude);
  }

  update(dt: number): void {
    const head = this.rig.head;

    if (this.hasGazeTarget) {
      // Convert the world target into head-local space, then derive yaw and pitch.
      this.tmpLocal.copy(this.gazeTarget);
      head.parent?.updateWorldMatrix(true, false);
      head.worldToLocal(this.tmpLocal);
      const horizontal = Math.hypot(this.tmpLocal.x, this.tmpLocal.z) || 1e-4;
      const yaw = Math.atan2(this.tmpLocal.x, this.tmpLocal.z);
      const pitch = Math.atan2(this.tmpLocal.y, horizontal);
      // Clamped so nobody performs an owl-turn to hold eye contact.
      this.life.lookToward(clamp(yaw, -0.85, 0.85), clamp(pitch, -0.45, 0.45));
    } else {
      this.life.lookToward(0, 0);
    }

    const s = this.life.update(dt);

    // Breath: the chest lifts and widens slightly.
    this.rig.chest.position.y = this.chestRestY + s.breath * 0.011;
    this.rig.chest.scale.set(1 + s.breath * 0.011, 1, 1 + s.breath * 0.015);

    // Weight shift: hips sway and the body counter-rotates a touch.
    this.rig.hips.position.x = s.weightShift * 0.02;
    this.rig.hips.rotation.z = -s.weightShift * 0.011;

    // Head follows the gaze, with the lag applied in Life.
    head.rotation.y = s.headYaw;
    head.rotation.x = -s.headPitch;

    // Eyes lead the head, so subtract what the head already contributed.
    const eyeYaw = clamp(s.eyeYaw - s.headYaw, -0.45, 0.45);
    const eyePitch = clamp(s.eyePitch - s.headPitch, -0.3, 0.3);
    for (const eye of [this.rig.leftEye, this.rig.rightEye]) {
      eye.rotation.y = eyeYaw;
      eye.rotation.x = -eyePitch;
      // Blink flattens the eye vertically. The authored rig will drive a
      // blendshape from this same signal.
      eye.scale.y = Math.max(0.08, 1 - s.blink);
    }

    // Jaw drop from real mic amplitude. Tier 4 of the realism hierarchy, and the
    // cheapest presence cue available since both mics are already open.
    head.rotation.x += s.jaw * 0.06;
  }

  dispose(): void {
    for (const material of this.rig.materials) material.dispose();
    disposeSubtree(this.root);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
