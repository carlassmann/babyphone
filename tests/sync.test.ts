import { expect, test } from 'bun:test';
import { startLocalJazzServer, deploy } from 'jazz-tools/dev';
import { createJazzContext } from 'jazz-tools/backend';
import { app } from '../schema';
import permissions from '../permissions';
import { Monitor } from '../server/monitor';

test('two independent Jazz backend replicas share room state and signaling', async () => {
  const server = await startLocalJazzServer({ inMemory: true });
  const contexts: ReturnType<typeof createJazzContext>[] = [];
  try {
    await deploy({
      appId: server.appId,
      serverUrl: server.url,
      adminSecret: server.adminSecret,
      schema: app,
      permissions,
    });
    const replica = () => {
      const context = createJazzContext({
        appId: server.appId,
        app,
        permissions,
        driver: { type: 'memory' },
        serverUrl: server.url,
        backendSecret: server.backendSecret,
      });
      contexts.push(context);
      return context.asBackend();
    };
    const first = replica();
    const second = replica();
    const firstMonitor = new Monitor(first, undefined, 'global');
    const secondMonitor = new Monitor(second, undefined, 'global');
    const baby = await firstMonitor.register({ name: 'Nursery', role: 'baby' });
    await eventually(async () =>
      (await second.all(app.rooms)).some((room) => room.id === baby.roomId),
    );
    const parent = await secondMonitor.register({
      name: 'Parent',
      role: 'parent',
      roomKey: baby.roomKey,
    });
    await firstMonitor.heartbeat(baby.deviceId, true, 0.2);
    await eventually(async () =>
      (await secondMonitor.state(baby.roomId)).devices.some(
        (device) => device.id === baby.deviceId && device.monitoring,
      ),
    );
    await secondMonitor.signal(
      await secondMonitor.authenticate(parent.deviceId, parent.token),
      baby.deviceId,
      { kind: 'offer', callId: 'test-call', description: { type: 'offer', sdp: 'test' } },
    );
    await eventually(async () =>
      (await first.all(app.signals.where({ target: baby.deviceId }))).some(
        (signal) => signal.source === parent.deviceId,
      ),
    );
    await eventually(async () => (await firstMonitor.state(baby.roomId)).devices.length === 2);
  } finally {
    for (const context of contexts) await context.shutdown();
    await server.stop();
  }
}, 30000);
async function eventually(predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(50);
  }
  throw new Error('Jazz replicas did not converge within 10 seconds');
}
