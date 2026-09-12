import { LevelHold, NoiseDetector, rms } from '../../../noise';
import { translate } from '../../../intl/standalone';

const SAMPLE_INTERVAL_MS = 100;
const WAKE_RETRY_MS = 1_000;

export class BabyAudio {
  stream?: MediaStream;

  private active = false;
  private audioContext?: AudioContext;
  private detector = new NoiseDetector();
  private levelHold = new LevelHold();
  private generation = 0;
  private sampleTimer?: ReturnType<typeof setInterval>;
  private wakeLock?: WakeLockSentinel;
  private wakeLockPending = false;

  constructor(
    private onLevel: (value: number) => void,
    private onNoise: () => void,
    private onError: (message: string) => void,
    private onWakeLockChange: (active: boolean) => void,
  ) {}

  set threshold(value: number) {
    this.detector.threshold = value;
  }

  async start() {
    const generation = ++this.generation;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(translate()('mic.https'));
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      video: false,
    });

    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    this.stream = stream;
    this.active = true;
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    if (generation !== this.generation) return;

    this.startSampling(stream, this.audioContext);
    this.watchForInterruptions(stream);
    await this.acquireWakeLock();
  }

  stop() {
    ++this.generation;
    this.active = false;
    clearInterval(this.sampleTimer);
    this.removeWakeLockListeners();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    void this.audioContext?.close();
    this.audioContext = undefined;
    void this.wakeLock?.release();
    this.wakeLock = undefined;
    this.onWakeLockChange(false);
    this.onLevel(0);
  }

  private startSampling(stream: MediaStream, audioContext: AudioContext) {
    this.detector = new NoiseDetector(this.detector.threshold);
    this.levelHold = new LevelHold();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2_048;
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    this.sampleTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const level = rms(samples);
      const now = performance.now();
      this.onLevel(this.levelHold.sample(level, now));
      if (this.detector.sample(level, now)) this.onNoise();
    }, SAMPLE_INTERVAL_MS);
  }

  private watchForInterruptions(stream: MediaStream) {
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => this.fail(translate()('mic.stopped'));
      track.onmute = () => this.fail(translate()('mic.interrupted'));
    });
    this.audioContext!.onstatechange = () => {
      if (this.active && this.audioContext?.state !== 'running') {
        this.fail(translate()('mic.suspended'));
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('pointerdown', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleVisibilityChange);
  }

  private fail(message: string) {
    this.stop();
    this.onError(message);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.active) void this.acquireWakeLock();
  };

  private removeWakeLockListeners() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('pointerdown', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleVisibilityChange);
  }

  private async acquireWakeLock() {
    if (!this.active || this.wakeLockPending) return;
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
      this.onWakeLockChange(false);
      return;
    }
    if (this.wakeLock && !this.wakeLock.released) return;

    this.wakeLockPending = true;
    const generation = this.generation;
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      if (!this.active || generation !== this.generation) {
        await wakeLock.release();
        return;
      }

      this.wakeLock = wakeLock;
      this.onWakeLockChange(true);
      wakeLock.addEventListener('release', () => {
        this.onWakeLockChange(false);
        if (this.active && document.visibilityState === 'visible') {
          setTimeout(() => {
            if (this.active) void this.acquireWakeLock();
          }, WAKE_RETRY_MS);
        }
      });
    } catch {
      this.onWakeLockChange(false);
    } finally {
      this.wakeLockPending = false;
    }
  }
}
