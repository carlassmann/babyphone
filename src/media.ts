import { NoiseDetector, rms } from './noise';
import type { Signal } from './protocol';
export class BabyAudio {
  stream?: MediaStream;
  private context?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private wake?: WakeLockSentinel;
  private detector = new NoiseDetector();
  private active = false;
  private generation = 0;
  constructor(
    private onLevel: (value: number) => void,
    private onNoise: () => void,
    private onError: (text: string) => void,
    private onWake: (active: boolean) => void,
  ) {}
  set threshold(value: number) {
    this.detector.threshold = value;
  }
  async start() {
    const generation = ++this.generation;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Microphone needs HTTPS or localhost. Open Pip using a secure address.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.active = true;
    this.context = new AudioContext();
    await this.context.resume();
    const source = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => this.fail('Microphone stopped. Restart monitoring.');
      track.onmute = () =>
        this.fail('Microphone interrupted. Keep Pip open, then restart monitoring.');
    });
    this.context.onstatechange = () => {
      if (this.active && this.context?.state !== 'running')
        this.fail('Audio was suspended. Keep Pip open and restart monitoring.');
    };
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      const volume = rms(data);
      this.onLevel(volume);
      if (this.detector.sample(volume, performance.now())) this.onNoise();
    }, 100);
    document.addEventListener('visibilitychange', this.visibility);
    await this.acquireWake();
  }
  private fail(message: string) {
    this.stop();
    this.onError(message);
  }
  private visibility = () => {
    if (document.visibilityState === 'visible' && this.active) void this.acquireWake();
  };
  private async acquireWake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
      this.onWake(false);
      return;
    }
    try {
      if (this.wake && !this.wake.released) return;
      const wake = await navigator.wakeLock.request('screen');
      if (!this.active) {
        await wake.release();
        return;
      }
      this.wake = wake;
      this.onWake(true);
      wake.addEventListener('release', () => {
        this.onWake(false);
        if (this.active && document.visibilityState === 'visible')
          setTimeout(() => {
            if (this.active) void this.acquireWake();
          }, 1000);
      });
    } catch {
      this.onWake(false);
    }
  }
  stop() {
    ++this.generation;
    this.active = false;
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.visibility);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    void this.context?.close();
    this.context = undefined;
    void this.wake?.release();
    this.wake = undefined;
    this.onWake(false);
    this.onLevel(0);
  }
}

type Call = {
  peer: RTCPeerConnection;
  target: string;
  callId: string;
  pending: RTCIceCandidateInit[];
  timeout: ReturnType<typeof setTimeout>;
};
export class AudioCalls {
  private calls = new Map<string, Call>();
  private iceServers: RTCIceServer[] = [];
  private generation = 0;
  private earlyCandidates = new Map<
    string,
    { source: string; candidates: RTCIceCandidateInit[]; at: number }
  >();
  constructor(
    private send: (target: string, payload: Signal) => void,
    private stream: () => MediaStream | undefined,
    private audio: HTMLAudioElement,
    private onStatus: (state: string, target?: string) => void,
  ) {}
  async configure() {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Audio configuration unavailable.');
    this.iceServers = (await response.json()).iceServers;
  }
  private create(target: string, callId: string, listening: boolean) {
    const peer = new RTCPeerConnection({ iceServers: this.iceServers });
    const call: Call = {
      peer,
      target,
      callId,
      pending: [],
      timeout: setTimeout(() => {
        this.end(callId);
        this.onStatus('Could not connect. Try again; different networks may need TURN.', target);
      }, 15000),
    };
    this.calls.set(callId, call);
    peer.onicecandidate = (event) => {
      if (event.candidate)
        this.send(target, { kind: 'ice', callId, candidate: event.candidate.toJSON() });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        clearTimeout(call.timeout);
        if (listening)
          this.onStatus(
            this.audio.paused ? 'Tap Resume audio to hear your baby.' : 'Listening live',
            target,
          );
      }
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        this.end(callId);
        if (listening) this.onStatus('Audio disconnected. Tap Listen to reconnect.', target);
      }
    };
    peer.ontrack = (event) => {
      this.audio.srcObject = event.streams[0] || new MediaStream([event.track]);
      void this.audio
        .play()
        .then(() => {
          if (this.calls.has(callId)) this.onStatus('Listening live', target);
        })
        .catch(() => {
          if (this.calls.has(callId)) this.onStatus('Tap Resume audio to hear your baby.', target);
        });
    };
    return call;
  }
  async listen(target: string) {
    this.stop();
    const generation = this.generation;
    this.onStatus('Connecting audio', target);
    await this.configure();
    if (generation !== this.generation) return;
    const callId = crypto.randomUUID();
    const { peer } = this.create(target, callId, true);
    peer.addTransceiver('audio', { direction: 'recvonly' });
    await peer.setLocalDescription(await peer.createOffer());
    this.send(target, { kind: 'offer', callId, description: peer.localDescription!.toJSON() });
  }
  async receive(source: string, signal: Signal) {
    for (const [id, entry] of this.earlyCandidates)
      if (Date.now() - entry.at > 30000) this.earlyCandidates.delete(id);
    let call = this.calls.get(signal.callId);
    if (signal.kind === 'ice' && signal.candidate && !call) {
      const entry = this.earlyCandidates.get(signal.callId) || {
        source,
        candidates: [],
        at: Date.now(),
      };
      if (
        entry.source === source &&
        entry.candidates.length < 32 &&
        this.earlyCandidates.size < 50
      ) {
        entry.candidates.push(signal.candidate);
        this.earlyCandidates.set(signal.callId, entry);
      }
      return;
    }
    if (signal.kind === 'stop') {
      if (call && call.target === source) {
        this.end(signal.callId, false);
        this.onStatus('Audio stopped');
      }
      return;
    }
    if (signal.kind === 'offer') {
      const stream = this.stream();
      if (!stream) {
        this.send(source, { kind: 'stop', callId: signal.callId });
        return;
      }
      for (const existing of this.calls.values())
        if (existing.target === source) this.end(existing.callId);
      const generation = this.generation;
      await this.configure();
      if (generation !== this.generation || this.stream() !== stream) return;
      call = this.create(source, signal.callId, false);
      stream.getTracks().forEach((track) => call!.peer.addTrack(track, stream));
      await call.peer.setRemoteDescription(signal.description!);
      const early = this.earlyCandidates.get(signal.callId);
      if (early?.source === source)
        for (const candidate of early.candidates) await call.peer.addIceCandidate(candidate);
      this.earlyCandidates.delete(signal.callId);
      await call.peer.setLocalDescription(await call.peer.createAnswer());
      this.send(source, {
        kind: 'answer',
        callId: signal.callId,
        description: call.peer.localDescription!.toJSON(),
      });
    } else if (call && call.target === source) {
      if (signal.kind === 'answer') {
        await call.peer.setRemoteDescription(signal.description!);
        for (const candidate of call.pending) await call.peer.addIceCandidate(candidate);
        call.pending = [];
      } else if (signal.kind === 'ice' && signal.candidate) {
        if (call.peer.remoteDescription) await call.peer.addIceCandidate(signal.candidate);
        else call.pending.push(signal.candidate);
      }
    }
  }
  private end(id: string, notify = true) {
    const call = this.calls.get(id);
    if (!call) return;
    this.calls.delete(id);
    clearTimeout(call.timeout);
    call.peer.close();
    if (notify) this.send(call.target, { kind: 'stop', callId: id });
    if (!this.calls.size) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
  }
  stop() {
    ++this.generation;
    this.earlyCandidates.clear();
    for (const id of [...this.calls.keys()]) this.end(id);
    this.onStatus('');
  }
}
