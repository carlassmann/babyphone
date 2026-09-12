export const SENSITIVITY_THRESHOLDS = [0.004, 0.00075, 0.00015] as const;

export function meterFraction(level: number) {
  if (level <= 0) return 0;
  const decibels = 20 * Math.log10(level);
  return Math.max(0, Math.min(1, (decibels + 80) / 60));
}

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
  private lastAlert = -Infinity;
  constructor(
    public threshold: number = SENSITIVITY_THRESHOLDS[1],
    private cooldown = 20000,
  ) {}
  sample(rms: number, now: number) {
    if (rms < this.threshold || now - this.lastAlert < this.cooldown) return false;
    this.lastAlert = now;
    return true;
  }
}
export function rms(samples: Float32Array) {
  return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
}
