import { expect, test } from 'bun:test';
import { LevelHold, NoiseDetector } from '../src/noise';
test('noise requires sustained sound, resets for silence, and repeats only after cooldown', () => {
  const detector = new NoiseDetector(0.1, 1500, 20000);
  expect(detector.sample(0.2, 0)).toBe(false);
  expect(detector.sample(0.2, 1000)).toBe(false);
  expect(detector.sample(0, 1200)).toBe(false);
  expect(detector.sample(0.2, 1600)).toBe(false);
  expect(detector.sample(0.2, 3100)).toBe(true);
  expect(detector.sample(0.2, 5000)).toBe(false);
  expect(detector.sample(0.2, 20000)).toBe(false);
  expect(detector.sample(0.2, 23100)).toBe(true);
});

test('default sensitivity detects normal speech with short gaps', () => {
  const detector = new NoiseDetector();
  for (let now = 0; now <= 1400; now += 100) {
    const speechLevel = now === 700 || now === 800 ? 0.0005 : 0.004;
    expect(detector.sample(speechLevel, now)).toBe(false);
  }
  expect(detector.sample(0.004, 1500)).toBe(true);
});

test('brief sounds remain visible long enough to notice', () => {
  const hold = new LevelHold();
  expect(hold.sample(0.004, 0)).toBe(0.004);
  expect(hold.sample(0, 500)).toBe(0.004);
  expect(hold.sample(0, 600)).toBe(0);
});
