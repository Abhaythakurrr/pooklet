import {
  PerspectiveCamera,
  Scene,
  Timer,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import type { Pose, RoomConfig, Slot } from '../../shared/protocol';
import { Character } from '@/characters/Character';
import { Room } from '@/net/Room';
import { Voice } from '@/net/Voice';
import { occasionFrom, type OccasionPreset } from '@/occasions/presets';
import { GardenZone } from '@/zones/garden/GardenZone';
import { gardenParams } from '@/zones/garden/params';
import type { BackendChoice } from './backend';
import { Controls } from './Controls';
import { Grade } from './Grade';
import { detectTier, type TierBudget } from './Tier';
import type { ZoneContext } from './Zone';
import { ZoneManager } from './ZoneManager';

const WALK_SPEED = 2.3;
/** Eye height. Matches the character's eye anchor so first and third person agree. */
const EYE_HEIGHT = 1.52;

export interface AppOptions {
  canvas: HTMLCanvasElement;
  apiBase: string;
  /** Null when the room service is unreachable — the visit then runs solo. */
  roomCode: string | null;
  /** Resolved by `pickBackend()` before construction, since it is async. */
  backend: BackendChoice;
  onStatus(text: string): void;
}

export class App {
  private readonly renderer: WebGPURenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  /** `Clock` is deprecated in this three.js version; `Timer` is the replacement. */
  private readonly timer = new Timer();
  private readonly controls: Controls;
  private readonly grade: Grade;
  private readonly tier: TierBudget;
  private readonly backendChoice: BackendChoice;

  private readonly local: Character;
  private readonly remote: Character;

  /** Both null on a solo visit, so the world stays walkable without a backend. */
  private readonly room: Room | null;
  private readonly voice: Voice | null;
  private readonly solo: boolean;

  private zones!: ZoneManager;
  private occasion: OccasionPreset = occasionFrom('birthday');

  /** Remote pose target, interpolated toward so 12Hz updates read as smooth. */
  private remoteTarget = new Vector3();
  private remoteTargetYaw = 0;
  /**
   * Until a pose actually arrives, leave her where the zone placed her. Without
   * this the target defaults to the origin and she visibly slides there on join.
   */
  private hasRemotePose = false;

  private readonly onStatus: (text: string) => void;
  private running = false;
  private elapsed = 0;

  constructor(options: AppOptions) {
    this.onStatus = options.onStatus;

    this.backendChoice = options.backend;
    this.tier = detectTier(!options.backend.forceWebGL);

    // One renderer, one shader language. WebGPU where available, and its own
    // WebGL2 backend everywhere else — including Quest, where WebGPU-on-WebXR is
    // not implemented. See .kiro/skills-manifest.json -> frameworkDecision.
    //
    // The backend was decided by `pickBackend()`, which actually requests a WebGPU
    // adapter first. Relying on the renderer's own fallback is not enough: it does
    // not cover WebGPU being present but broken, which renders nothing at all.
    this.renderer = new WebGPURenderer({
      canvas: options.canvas,
      antialias: this.tier.name !== 'mobile',
      forceWebGL: options.backend.forceWebGL,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.tier.shadowMapSize > 0;

    this.grade = new Grade(this.renderer);

    this.camera = new PerspectiveCamera(
      this.tier.name === 'mobile' ? 68 : 58,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );

    this.controls = new Controls(options.canvas);

    // Roles are assigned by slot for now: the host is the groom and the guest the
    // bride. Character selection is part of The Making and is not built yet, so
    // this is a placeholder assignment, not a product decision.
    this.local = new Character(true, 'groom', 0xd8a884);
    this.remote = new Character(false, 'bride', 0xe6bd9c);
    this.scene.add(this.local.root, this.remote.root);

    this.solo = options.roomCode === null;

    if (this.solo) {
      this.room = null;
      this.voice = null;
      // Nobody to meet, so do not render an unmoving body standing there.
      this.remote.root.visible = false;
    } else {
      this.voice = new Voice({
        sendSignal: (data) => this.room?.signal(data),
        onStatus: this.onStatus,
      });

      this.room = new Room(options.apiBase, options.roomCode!, {
        onWelcome: (slot, config, shouldOffer) => this.handleWelcome(slot, config, shouldOffer),
        onPeerJoin: () => {
          // Whoever is slot 1 initiates, so a late joiner still gets connected.
          if (this.room?.slot === 1) void this.voice?.makeOffer();
        },
        onPeerLeave: () => {
          this.remote.clearGaze();
          // She may rejoin somewhere else, so do not keep interpolating toward a
          // stale position.
          this.hasRemotePose = false;
        },
        onPeerPose: (pose) => this.applyRemotePose(pose),
        onPeerReady: (zone) => {
          if (this.zones.activeZone?.params.id === zone) this.zones.setRemoteReady(true);
        },
        onSignal: (data) => void this.voice?.handleSignal(data),
        onFull: () => this.onStatus('this place is only for two'),
        onStatus: this.onStatus,
      });
    }

    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private handleWelcome(slot: Slot, config: RoomConfig, shouldOffer: boolean): void {
    this.occasion = occasionFrom(config.occasion);
    if (shouldOffer) void this.voice?.makeOffer();
    void slot;
  }

  private applyRemotePose(pose: Pose): void {
    this.remoteTarget.set(pose.x, 0, pose.z);
    this.remoteTargetYaw = pose.ry;
    if (!this.hasRemotePose) {
      // Snap on the first pose rather than gliding in from wherever she was
      // placed, which would read as a ghost sliding across the garden.
      this.remote.root.position.set(pose.x, 0, pose.z);
      this.remote.root.rotation.y = pose.ry;
      this.hasRemotePose = true;
    }
  }

  async start(): Promise<void> {
    await this.renderer.init();

    // Report the backend explicitly. WebGPURenderer silently falls back to WebGL2,
    // which is desirable but means you cannot tell which path you are on — and the
    // two differ in what they can do (compute shaders, and therefore the FFT
    // ocean and GPU-culled foliage).
    // `isWebGPUBackend` is set on WebGPUBackend at runtime but is absent from the
    // published types, hence the narrow cast.
    const backend = (this.renderer.backend as unknown as { isWebGPUBackend?: boolean })
      ?.isWebGPUBackend
      ? 'webgpu'
      : 'webgl2';
    console.info(
      `[pooklet] tier=${this.tier.name} backend=${backend} (${this.backendChoice.reason}) ` +
        `compute=${this.tier.computeAvailable && backend === 'webgpu'} ` +
        `pixelRatio=${this.renderer.getPixelRatio()}`,
    );

    // Voice needs a user gesture, and start() is called from the button handler.
    if (this.voice) {
      try {
        await this.voice.start();
      } catch {
        this.onStatus('no microphone — you can still walk together');
      }
    }

    this.room?.connect();
    if (this.solo) {
      this.onStatus('a solo visit — the room service is not running');
    }

    const ctx: ZoneContext = {
      scene: this.scene,
      camera: this.camera,
      grade: this.grade,
      tier: this.tier,
      occasion: this.occasion,
      characters: [this.local, this.remote],
      solo: this.solo,
    };

    // Only the Garden exists so far. The sequence grows by appending factories —
    // the contract is what matters, and it is proven here first.
    this.zones = new ZoneManager(
      [() => new GardenZone(this.occasion.accent, this.occasion.accentAlt, gardenParams(this.occasion))],
      ctx,
    );
    this.zones.onLocalReady = (zoneId) => this.room?.announceReady(zoneId);
    // Nobody to wait for on a solo visit, so do not stall the sequence forever.
    if (this.solo) this.zones.setRemoteReady(true);
    this.zones.onZoneChange = (zone) => this.onStatus(zone.params.title);
    this.zones.onTransition = (report) => {
      console.info(`[zone] ${report.from} -> ${report.to} in ${report.ms}ms`);
    };

    await this.zones.start();

    this.running = true;
    this.renderer.setAnimationLoop(this.frame);
  }

  private readonly frame = (time: number): void => {
    if (!this.running) return;
    this.timer.update(time);
    // Clamped so a backgrounded tab does not resume with one enormous step that
    // teleports both characters.
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    this.elapsed += dt;

    this.controls.poll();
    this.stepLocal(dt);
    this.stepRemote(dt);

    if (this.voice) {
      this.voice.sampleAmplitudes();
      this.local.setVoiceAmplitude(this.voice.localAmplitude);
      this.remote.setVoiceAmplitude(this.voice.remoteAmplitude);
    }

    this.local.update(dt);
    if (!this.solo) this.remote.update(dt);

    this.zones.update(dt, this.elapsed);
    this.grade.update(dt);

    this.voice?.updateSpatial(
      this.local.root.position.x,
      this.local.root.position.z,
      this.controls.yaw,
      this.remote.root.position.x,
      this.remote.root.position.z,
    );

    this.room?.sendPose(dt, {
      x: round(this.local.root.position.x),
      z: round(this.local.root.position.z),
      ry: round(this.controls.yaw),
    });

    this.placeCamera();
    void this.renderer.renderAsync(this.scene, this.camera).then(() => this.sampleFrame());
  };

  private stepLocal(dt: number): void {
    const { x, y } = this.controls.move;
    if (x === 0 && y === 0) return;

    const yaw = this.controls.yaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    // Right-hand perpendicular of forward on the XZ plane.
    const rightX = forwardZ;
    const rightZ = -forwardX;

    const position = this.local.root.position;
    position.x += (forwardX * y + rightX * x) * WALK_SPEED * dt;
    position.z += (forwardZ * y + rightZ * x) * WALK_SPEED * dt;

    const bounds = this.zones.activeZone?.params.bounds ?? 20;
    const distance = Math.hypot(position.x, position.z);
    if (distance > bounds) {
      position.x = (position.x / distance) * bounds;
      position.z = (position.z / distance) * bounds;
    }

    this.local.root.rotation.y = yaw;
  }

  private stepRemote(dt: number): void {
    if (!this.hasRemotePose) return;

    // Exponential interpolation toward the last received pose. At 12Hz this is
    // the difference between presence and a puppet show.
    const k = 1 - Math.exp(-dt / 0.09);
    const position = this.remote.root.position;
    position.x += (this.remoteTarget.x - position.x) * k;
    position.z += (this.remoteTarget.z - position.z) * k;

    let delta = this.remoteTargetYaw - this.remote.root.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.remote.root.rotation.y += delta * k;
  }

  private placeCamera(): void {
    // Over-the-shoulder, so you can see your own body and hers. Seeing your own
    // body matters: legless floating torsos are a documented source of weirdness.
    //
    // Pulled back and raised from the first pass, where the character filled most
    // of the frame and hid the space behind them. Offset to the side as well, so
    // the body sits off-centre and leaves room to see who you came here with.
    const yaw = this.controls.yaw;
    const pitch = this.controls.pitch;
    const distance = 4.2;
    const sideOffset = 0.55;
    const origin = this.local.root.position;

    const backX = -Math.sin(yaw) * distance;
    const backZ = -Math.cos(yaw) * distance;
    // Perpendicular, to nudge the rig off the character's spine.
    const sideX = Math.cos(yaw) * sideOffset;
    const sideZ = -Math.sin(yaw) * sideOffset;

    this.camera.position.set(
      origin.x + backX + sideX,
      EYE_HEIGHT + 0.72 - pitch * 1.6,
      origin.z + backZ + sideZ,
    );
    // Aim a little ahead of the character rather than at them, which keeps the
    // horizon in frame instead of pointing at the ground.
    this.camera.lookAt(
      origin.x + Math.sin(yaw) * 2.2,
      EYE_HEIGHT + 0.1,
      origin.z + Math.cos(yaw) * 2.2,
    );
  }

  /**
   * Samples the rendered frame from inside the render loop.
   *
   * Reading a WebGPU canvas after the frame is composited returns blank, which
   * made the first smoke test report an empty scene that was in fact rendering
   * fine. Sampling here, in the same frame, is the honest measurement.
   */
  private sampleFrame(): void {
    const flag = (window as unknown as { __pookletWantProbe?: boolean });
    if (!flag.__pookletWantProbe) return;
    flag.__pookletWantProbe = false;

    const source = this.renderer.domElement as HTMLCanvasElement;
    const probe = document.createElement('canvas');
    probe.width = 160;
    probe.height = 100;
    const ctx = probe.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);

    let nonBlack = 0;
    const buckets = new Set<string>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 24) nonBlack += 1;
      buckets.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
    }

    (window as unknown as { __pookletProbe?: unknown }).__pookletProbe = {
      width: source.width,
      height: source.height,
      nonBlackRatio: nonBlack / (data.length / 4),
      distinctColours: buckets.size,
    };
  }

  dispose(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.zones?.dispose();
    this.room?.dispose();
    this.voice?.dispose();
    this.local.dispose();
    this.remote.dispose();
    void this.renderer.dispose();
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
