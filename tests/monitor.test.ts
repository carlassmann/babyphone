import { expect, test } from 'bun:test';
import { LevelHold, meterFraction, NoiseDetector } from '../src/noise';
import { recentEvent } from '../src/features/room/lib/recent-event';
import type { Alert } from '../src/protocol';
test('noise requires sustained sound, resets for silence, and repeats only after cooldown', () => {
  const detector = new NoiseDetector(0.1, 1500, 20000);
  expect(detector.sample(0.2, 0)).toBe(false);
  expect(detector.sample(0.2, 1000)).toBe(false);
  expect(detector.sample(0, 1200)).toBe(false);
  expect(detector.sample(0.2, 1800)).toBe(false);
  expect(detector.sample(0.2, 3300)).toBe(true);
  expect(detector.sample(0.2, 5000)).toBe(false);
  expect(detector.sample(0.2, 20000)).toBe(false);
  expect(detector.sample(0.2, 23300)).toBe(true);
});

test('default sensitivity detects normal speech with short gaps', () => {
  const detector = new NoiseDetector();
  for (let now = 0; now <= 1400; now += 100) {
    const speechLevel = now === 700 || now === 800 ? 0.0001 : 0.001;
    expect(detector.sample(speechLevel, now)).toBe(false);
  }
  expect(detector.sample(0.001, 1500)).toBe(true);
});

test('brief sounds remain visible long enough to notice', () => {
  const hold = new LevelHold();
  expect(hold.sample(0.004, 0)).toBe(0.004);
  expect(hold.sample(0, 500)).toBe(0.004);
  expect(hold.sample(0, 600)).toBe(0);
});

test('quiet speech produces a visible meter reading', () => {
  expect(meterFraction(0)).toBe(0);
  expect(meterFraction(0.001)).toBeGreaterThan(0.3);
  expect(meterFraction(0.01)).toBeGreaterThan(0.6);
  expect(meterFraction(1)).toBe(1);
});

test('dismissing an alert clears the current backlog but not new alerts', () => {
  const now = 100_000;
  const events = [
    { id: 'new', at: now - 1_000 },
    { id: 'older', at: now - 2_000 },
  ] as Alert[];
  const visible = recentEvent(events, 0, now, 60_000);
  expect(visible?.id).toBe('new');
  expect(recentEvent(events, visible!.at, now, 60_000)).toBeUndefined();
  expect(
    recentEvent([{ id: 'next', at: now + 1 } as Alert, ...events], visible!.at, now + 1, 60_000)
      ?.id,
  ).toBe('next');
});
