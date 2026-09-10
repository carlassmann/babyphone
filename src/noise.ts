export const SENSITIVITY_THRESHOLDS = [0.012, 0.003, 0.001] as const;

export class LevelHold {
  private level = 0;
  private until = -Infinity;

  constructor(private duration = 600) {}

  sample(level: number, now: number) {
    if (level >= this.level || now >= this.until) {
      this.level = level;
      this.until = now + this.duration;
    }
    return this.level;
  }
}

export class NoiseDetector {
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private lastAlert = -Infinity;
  constructor(
    public threshold: number = SENSITIVITY_THRESHOLDS[1],
    private sustain = 1500,
    private cooldown = 20000,
    private release = 300,
  ) {}
  sample(rms: number, now: number) {
    if (rms < this.threshold) {
      this.belowSince ??= now;
      if (now - this.belowSince > this.release) this.aboveSince = null;
      return false;
    }
    if (this.belowSince !== null && now - this.belowSince > this.release) this.aboveSince = null;
    this.belowSince = null;
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
