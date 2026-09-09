import { expect, test } from 'bun:test';
import { NoiseDetector } from '../src/noise';
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
