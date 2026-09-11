/**
 * The procedural "alive" layer.
 *
 * Tiers 2-4 of the realism hierarchy: gaze, living motion, and a mouth driven by
 * real voice. The research is blunt about why this matters more than geometry —
 * artificial faces are largely not judged artificial until the eyes are
 * considered, and correct gaze beats photorealism outright. The uncanny valley
 * comes from good geometry with dead eyes, not from realism itself.
 *
 * Deliberately character-agnostic: it produces normalised signals, so it can be
 * proven on the MakeHuman blockout and then driven into a Character Creator rig
 * without change.
 *
 * See .kiro/steering/concept.md -> "Avatar realism".
 */

export interface LifeSignals {
  /** 0 = open, 1 = fully closed. */
  blink: number;
  /** -1..1, chest and shoulder rise. */
  breath: number;
  /** -1..1 lateral hip sway during idle. */
  weightShift: number
  /** 0..1 jaw opening, driven by real mic amplitude. */
  jaw: number;
  /** Radians, head yaw and pitch offset toward the gaze target. */
  headYaw: number;
  headPitch: number;
  /** Radians, eye offset. Eyes lead the head, as real eyes do. */
  eyeYaw: number;
  eyePitch: number;
}

const TWO_PI = Math.PI * 2;

/** Humans blink irregularly. A metronome blink reads as a machine. */
function nextBlinkDelay(): number {
  // Roughly 2-7s, weighted toward the shorter end.
  return 2 + Math.random() * Math.random() * 5;
}

export class Life {
  readonly signals: LifeSignals = {
    blink: 0,
    breath: 0,
    weightShift: 0,
    jaw: 0,
    headYaw: 0,
    headPitch: 0,
    eyeYaw: 0,
    eyePitch: 0,
  };

  private blinkTimer = nextBlinkDelay();
  private blinkProgress = -1;
  private readonly blinkDuration = 0.13;

  private breathPhase = Math.random() * TWO_PI;
  /** Slightly under a resting adult rate, and jittered per character. */
  private readonly breathRate = 0.22 + Math.random() * 0.05;

  private shiftPhase = Math.random() * TWO_PI;
  private readonly shiftRate = 0.06 + Math.random() * 0.03;

  private jawSmoothed = 0;

  /** Where the character wants to look, in its own local space. */
  private desiredYaw = 0;
  private desiredPitch = 0;

  /** Saccade state: eyes jump between fixations rather than gliding. */
  private saccadeTimer = 0;
  private saccadeYaw = 0;
  private saccadePitch = 0;

  /**
   * @param yaw   radians, positive is to the character's left
   * @param pitch radians, positive is up
   */
  lookToward(yaw: number, pitch: number): void {
    this.desiredYaw = yaw;
    this.desiredPitch = pitch;
  }

  /** @param amplitude 0..1 from the mic analyser. */
  setVoiceAmplitude(amplitude: number): void {
    // Attack fast, release slow. Mouths open quicker than they close.
    const target = Math.min(1, amplitude * 1.6);
    const k = target > this.jawSmoothed ? 0.55 : 0.12;
    this.jawSmoothed += (target - this.jawSmoothed) * k;
  }

  update(dt: number): LifeSignals {
    const s = this.signals;

    // --- Blink -------------------------------------------------------------
    if (this.blinkProgress >= 0) {
      this.blinkProgress += dt;
      const t = this.blinkProgress / this.blinkDuration;
      if (t >= 1) {
        this.blinkProgress = -1;
        s.blink = 0;
        this.blinkTimer = nextBlinkDelay();
      } else {
        // Closing is faster than opening, which is how eyelids actually move.
        s.blink = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      }
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) this.blinkProgress = 0;
    }

    // --- Breath ------------------------------------------------------------
    this.breathPhase += dt * this.breathRate * TWO_PI;
    if (this.breathPhase > TWO_PI) this.breathPhase -= TWO_PI;
    // Asymmetric: inhale quicker than exhale.
    const raw = Math.sin(this.breathPhase);
    s.breath = raw > 0 ? Math.pow(raw, 0.7) : -Math.pow(-raw, 1.3);

    // --- Weight shift ------------------------------------------------------
    this.shiftPhase += dt * this.shiftRate * TWO_PI;
    if (this.shiftPhase > TWO_PI) this.shiftPhase -= TWO_PI;
    s.weightShift = Math.sin(this.shiftPhase) * 0.8 + Math.sin(this.shiftPhase * 2.3) * 0.2;

    // --- Jaw ---------------------------------------------------------------
    s.jaw = this.jawSmoothed;

    // --- Gaze --------------------------------------------------------------
    // Eyes lead, head follows. This is the detail that reads as attention.
    this.saccadeTimer -= dt;
    if (this.saccadeTimer <= 0) {
      // Small fixation jumps around the target, then settle back.
      this.saccadeYaw = (Math.random() - 0.5) * 0.06;
      this.saccadePitch = (Math.random() - 0.5) * 0.04;
      this.saccadeTimer = 0.25 + Math.random() * 1.1;
    }

    const eyeTargetYaw = this.desiredYaw + this.saccadeYaw;
    const eyeTargetPitch = this.desiredPitch + this.saccadePitch;
    const eyeK = 1 - Math.exp(-dt / 0.045);
    s.eyeYaw += (eyeTargetYaw - s.eyeYaw) * eyeK;
    s.eyePitch += (eyeTargetPitch - s.eyePitch) * eyeK;

    // The head only commits to part of the rotation, and lags well behind.
    const headK = 1 - Math.exp(-dt / 0.32);
    s.headYaw += (this.desiredYaw * 0.55 - s.headYaw) * headK;
    s.headPitch += (this.desiredPitch * 0.4 - s.headPitch) * headK;

    return s;
  }
}
