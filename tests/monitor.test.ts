import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database';
import { Monitor, validSubscription } from '../server/monitor';
import { app } from '../schema';
import { NoiseDetector } from '../src/noise';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'pip-test-'));
  const database = openDatabase(join(dir, 'jazz'));
  cleanup.push(async () => {
    await database.context.shutdown();
    await rm(dir, { recursive: true, force: true });
  });
  const delivered: object[] = [];
  const monitor = new Monitor(database.db, async (sub, payload) => {
    delivered.push({ sub, payload });
  });
  return { ...database, monitor, delivered };
}
test('room capability and device credentials isolate signaling and private state', async () => {
  const { monitor } = await fixture();
  const baby = await monitor.register({ name: 'Nursery', role: 'baby' });
  const parent = await monitor.register({ name: 'Dad', role: 'parent', roomKey: baby.roomKey });
  const outsider = await monitor.register({ name: 'Other family', role: 'parent' });
  expect(parent.roomId).toBe(baby.roomId);
  await expect(
    monitor.register({ name: 'Intruder', role: 'parent', roomKey: 'bad-code' }),
  ).rejects.toThrow('Room not found');
  await expect(monitor.authenticate(baby.deviceId, parent.token)).rejects.toThrow('expired');
  await monitor.heartbeat(baby.deviceId, true, 0.2);
  const device = await monitor.authenticate(parent.deviceId, parent.token);
  await expect(
    monitor.signal(device, outsider.deviceId, { kind: 'offer', callId: 'test' }),
  ).rejects.toThrow('unavailable');
  await expect(
    monitor.signal(await monitor.authenticate(outsider.deviceId, outsider.token), baby.deviceId, {
      kind: 'offer',
      callId: 'test',
    }),
  ).rejects.toThrow('unavailable');
  const state = await monitor.state(parent.roomId);
  expect(state.devices).toHaveLength(2);
  expect(JSON.stringify(state)).not.toContain('tokenHash');
  expect(JSON.stringify(state)).not.toContain(parent.token);
});
test('noise fans out to every subscribed parent, cooldown survives refresh, missing heartbeat emits once and recovers', async () => {
  const { monitor, db, delivered } = await fixture();
  const baby = await monitor.register({ name: 'Nursery', role: 'baby' });
  const parents = await Promise.all(
    ['Mom', 'Dad'].map((name) => monitor.register({ name, role: 'parent', roomKey: baby.roomKey })),
  );
  for (const p of parents)
    db.update(app.devices, p.deviceId, {
      subscription: JSON.stringify({ endpoint: p.name, keys: {} }),
    });
  await monitor.heartbeat(baby.deviceId, true, 0.2);
  await monitor.alert(await monitor.authenticate(baby.deviceId, baby.token), 'noise');
  await monitor.alert(await monitor.authenticate(baby.deviceId, baby.token), 'noise');
  expect(delivered).toHaveLength(2);
  expect((await monitor.state(baby.roomId)).events).toHaveLength(1);
  await monitor.sweep(Date.now() + 13000);
  await monitor.sweep(Date.now() + 14000);
  expect(delivered).toHaveLength(4);
  expect(
    (await monitor.state(baby.roomId)).events.filter((e) => e.kind === 'offline'),
  ).toHaveLength(1);
  await monitor.heartbeat(baby.deviceId, true, 0.1);
  expect(
    (await monitor.state(baby.roomId)).devices.find((d) => d.id === baby.deviceId)?.monitoring,
  ).toBe(true);
  await monitor.heartbeat(baby.deviceId, false, 0);
  expect((await monitor.state(baby.roomId)).events.some((e) => e.kind === 'paused')).toBe(true);
  expect(delivered).toHaveLength(6);
});
test('Jazz persists room invitations and credentials across runtime restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pip-persist-'));
  const path = join(dir, 'jazz');
  const first = openDatabase(path);
  const baby = await new Monitor(first.db).register({ name: 'Nursery', role: 'baby' });
  await first.context.shutdown();
  const second = openDatabase(path);
  try {
    const monitor = new Monitor(second.db);
    expect((await monitor.authenticate(baby.deviceId, baby.token)).name).toBe('Nursery');
    expect(
      (await monitor.register({ name: 'Parent', role: 'parent', roomKey: baby.roomKey })).roomId,
    ).toBe(baby.roomId);
  } finally {
    await second.context.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
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
test('push destinations cannot target local or arbitrary servers', () => {
  const keys = { auth: 'a', p256dh: 'b' };
  expect(validSubscription({ endpoint: 'http://127.0.0.1/secrets', keys })).toBe(false);
  expect(validSubscription({ endpoint: 'https://fcm.googleapis.com.evil.example', keys })).toBe(
    false,
  );
  expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys })).toBe(
    true,
  );
});
