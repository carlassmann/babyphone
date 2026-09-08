export class NoiseDetector {
  private aboveSince: number | null = null;
  private lastAlert = -Infinity;
  constructor(
    public threshold = 0.08,
    private sustain = 1500,
    private cooldown = 20000,
  ) {}
  sample(rms: number, now: number) {
    if (rms < this.threshold) {
      this.aboveSince = null;
      return false;
    }
    this.aboveSince ??= now;
    if (now - this.aboveSince < this.sustain || now - this.lastAlert < this.cooldown) return false;
    this.lastAlert = now;
    this.aboveSince = null;
    return true;
  }
}
export function rms(samples: Float32Array) {
  return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
}
