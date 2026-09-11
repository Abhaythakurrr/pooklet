/**
 * Live voice between exactly two people.
 *
 * Voice is the feature, not a bonus. Most of the emotion will come from hearing
 * each other, not from the render — and when voice quality and visual fidelity
 * compete, voice wins. It also does double duty: the amplitude drives each
 * character's jaw, which is tier 4 of the realism hierarchy.
 *
 * Peer-to-peer is the right shape for two participants: one hop, lowest latency,
 * no media server. The Durable Object only relays signalling.
 *
 * See .kiro/steering/concept.md -> "Design principles" and "Avatar realism".
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

export interface VoiceHandlers {
  /** Send an opaque signalling blob to the peer via the room. */
  sendSignal(data: unknown): void;
  onStatus(text: string): void;
}

interface AnalyserPair {
  analyser: AnalyserNode;
  /**
   * Backed by an explicit ArrayBuffer. `getByteTimeDomainData` will not accept a
   * possibly-SharedArrayBuffer-backed view.
   */
  buffer: Uint8Array<ArrayBuffer>;
}

function timeDomainBuffer(analyser: AnalyserNode): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
}

export class Voice {
  private pc: RTCPeerConnection | null = null;
  private audioCtx: AudioContext | null = null;
  private localStream: MediaStream | null = null;

  private localAnalyser: AnalyserPair | null = null;
  private remoteAnalyser: AnalyserPair | null = null;

  /** Positional node so a voice arrives from where the body is. */
  private panner: PannerNode | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;

  private readonly handlers: VoiceHandlers;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private haveRemoteDescription = false;

  localAmplitude = 0;
  remoteAmplitude = 0;

  constructor(handlers: VoiceHandlers) {
    this.handlers = handlers;
  }

  /**
   * Must be called from a user gesture — both getUserMedia and AudioContext
   * require it, and mobile Safari is strict about it.
   */
  async start(): Promise<void> {
    this.audioCtx = new AudioContext();
    await this.audioCtx.resume();

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.localAnalyser = this.makeAnalyser(
      this.audioCtx.createMediaStreamSource(this.localStream),
      false,
    );

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }

    this.pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        this.handlers.sendSignal({ kind: 'ice', candidate: event.candidate.toJSON() });
      }
    });

    this.pc.addEventListener('connectionstatechange', () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') this.handlers.onStatus('you can hear each other');
      if (state === 'failed') this.handlers.onStatus('voice failed to connect');
    });

    this.pc.addEventListener('track', (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      this.attachRemote(stream);
    });
  }

  private makeAnalyser(source: AudioNode, connectToDestination: boolean): AnalyserPair {
    const ctx = this.audioCtx!;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    if (connectToDestination) analyser.connect(ctx.destination);
    return { analyser, buffer: timeDomainBuffer(analyser) };
  }

  private attachRemote(stream: MediaStream): void {
    const ctx = this.audioCtx!;

    // Chrome will not run a remote WebRTC stream through WebAudio unless the
    // stream is also attached to a media element. Muted element, real output goes
    // through the graph.
    const el = document.createElement('audio');
    el.srcObject = stream;
    el.muted = true;
    el.autoplay = true;
    void el.play().catch(() => undefined);
    this.remoteAudioEl = el;

    const source = ctx.createMediaStreamSource(stream);

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.2;
    panner.maxDistance = 28;
    panner.rolloffFactor = 1.1;
    this.panner = panner;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;

    source.connect(analyser);
    analyser.connect(panner);
    panner.connect(ctx.destination);

    this.remoteAnalyser = { analyser, buffer: timeDomainBuffer(analyser) };
  }

  /** Slot 1 offers, decided by the room so both sides cannot offer at once. */
  async makeOffer(): Promise<void> {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.handlers.sendSignal({ kind: 'sdp', description: offer });
  }

  async handleSignal(data: unknown): Promise<void> {
    if (!this.pc || !data || typeof data !== 'object') return;
    const payload = data as { kind?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

    if (payload.kind === 'sdp' && payload.description) {
      await this.pc.setRemoteDescription(payload.description);
      this.haveRemoteDescription = true;

      for (const candidate of this.pendingCandidates) {
        await this.pc.addIceCandidate(candidate).catch(() => undefined);
      }
      this.pendingCandidates = [];

      if (payload.description.type === 'offer') {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.handlers.sendSignal({ kind: 'sdp', description: answer });
      }
      return;
    }

    if (payload.kind === 'ice' && payload.candidate) {
      if (!this.haveRemoteDescription) {
        // Candidates can arrive before the description; queue rather than throw.
        this.pendingCandidates.push(payload.candidate);
        return;
      }
      await this.pc.addIceCandidate(payload.candidate).catch(() => undefined);
    }
  }

  /**
   * Place the listener at the local character and the remote voice at the remote
   * character, so her voice comes from where she is standing.
   */
  updateSpatial(
    listenerX: number,
    listenerZ: number,
    listenerYaw: number,
    peerX: number,
    peerZ: number,
  ): void {
    const ctx = this.audioCtx;
    if (!ctx) return;

    const listener = ctx.listener;
    const t = ctx.currentTime;
    const forwardX = Math.sin(listenerYaw);
    const forwardZ = Math.cos(listenerYaw);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(listenerX, t);
      listener.positionY.setValueAtTime(1.6, t);
      listener.positionZ.setValueAtTime(listenerZ, t);
      listener.forwardX.setValueAtTime(forwardX, t);
      listener.forwardY.setValueAtTime(0, t);
      listener.forwardZ.setValueAtTime(forwardZ, t);
      listener.upX.setValueAtTime(0, t);
      listener.upY.setValueAtTime(1, t);
      listener.upZ.setValueAtTime(0, t);
    }

    if (this.panner?.positionX) {
      this.panner.positionX.setValueAtTime(peerX, t);
      this.panner.positionY.setValueAtTime(1.5, t);
      this.panner.positionZ.setValueAtTime(peerZ, t);
    }
  }

  /** Reads both analysers. Call once per frame. */
  sampleAmplitudes(): void {
    this.localAmplitude = readLevel(this.localAnalyser);
    this.remoteAmplitude = readLevel(this.remoteAnalyser);
  }

  dispose(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.remoteAudioEl?.remove();
    this.remoteAudioEl = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }
}

function readLevel(pair: AnalyserPair | null): number {
  if (!pair) return 0;
  pair.analyser.getByteTimeDomainData(pair.buffer);
  let sum = 0;
  for (let i = 0; i < pair.buffer.length; i += 1) {
    const v = (pair.buffer[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / pair.buffer.length);
  // Speech RMS sits low; scale so normal talking lands near the top of 0..1.
  return Math.min(1, rms * 6);
}
