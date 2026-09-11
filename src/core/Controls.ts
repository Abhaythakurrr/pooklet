/**
 * Locomotion input, mobile-first.
 *
 * Phones are the primary target, so touch is the reference implementation and
 * keyboard is the addition, not the other way round. Left half of the screen
 * steers movement, right half looks around; on desktop, WASD plus pointer drag.
 *
 * Deliberately no camera motion the user did not initiate — that is a comfort
 * rule in VR and it happens to be the right feel everywhere else too.
 */
export class Controls {
  /** -1..1 strafe, -1..1 forward. */
  move = { x: 0, y: 0 };
  /** Accumulated yaw in radians. */
  yaw = 0;
  /** Accumulated pitch in radians, clamped. */
  pitch = 0;

  private readonly keys = new Set<string>();
  private readonly element: HTMLElement;

  private movePointer: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    this.element.setPointerCapture(e.pointerId);
    const isLeftHalf = e.clientX < window.innerWidth * 0.5;
    if (isLeftHalf && e.pointerType === 'touch' && this.movePointer === null) {
      this.movePointer = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
    } else if (this.lookPointer === null) {
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (e.pointerId === this.movePointer) {
      const dx = e.clientX - this.moveOrigin.x;
      const dy = e.clientY - this.moveOrigin.y;
      const radius = 64;
      this.move.x = clamp(dx / radius, -1, 1);
      this.move.y = clamp(-dy / radius, -1, 1);
      return;
    }
    if (e.pointerId === this.lookPointer) {
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.0045;
      this.pitch = clamp(this.pitch - dy * 0.0035, -0.9, 0.9);
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.movePointer) {
      this.movePointer = null;
      this.move.x = 0;
      this.move.y = 0;
    }
    if (e.pointerId === this.lookPointer) this.lookPointer = null;
  };

  constructor(element: HTMLElement) {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Folds keyboard state into `move`. Call before reading it each frame. */
  poll(): void {
    if (this.movePointer !== null) return;
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    this.move.x = x;
    this.move.y = y;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
