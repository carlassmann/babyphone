import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createECDH, randomBytes } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions, Response as WorkerResponse } from 'miniflare';
import webpush from 'web-push';
import type { Session } from '../src/protocol.ts';

async function eventually(check: () => Promise<boolean>, timeout = 18000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('Expected Workers state did not arrive');
}

test(
  'Workers room isolation, encrypted push retries, TURN auth, and watchdog survive runtime restart',
  { timeout: 45000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pip-workers-'));
    const vapid = webpush.generateVAPIDKeys();
    const attempts = new Map<string, number>();
    let turnRequests = 0;
    const options = convertV4MiniflareOptions({
      name: 'pip-test',
      modules: true,
      scriptPath: resolve('.worker-build/index.js'),
      compatibilityDate: '2026-09-07',
      compatibilityFlags: ['nodejs_compat'],
      durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
      durableObjectsPersist: directory,
      bindings: {
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        TURN_KEY_ID: 'test-key',
        TURN_KEY_API_TOKEN: 'server-secret',
      },
      outboundService: async (request) => {
        const url = new URL(request.url);
        if (url.hostname === 'rtc.live.cloudflare.com') {
          assert.equal(request.headers.get('authorization'), 'Bearer server-secret');
          assert.equal(((await request.json()) as { ttl: number }).ttl, 86400);
          turnRequests++;
          return new WorkerResponse(
            JSON.stringify({
              iceServers: [
                {
                  urls: [
                    'turns:turn.cloudflare.com:443?transport=tcp',
                    'turn:turn.cloudflare.com:53?transport=udp',
                  ],
                  username: 'temporary-user',
                  credential: 'temporary-password',
                },
              ],
            }),
            { status: 201 },
          );
        }
        assert.equal(url.hostname, 'fcm.googleapis.com');
        assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
        const authorization = request.headers.get('authorization') || '';
        assert.match(authorization, /^vapid /);
        const token = authorization.match(/t=([^,]+)/)![1];
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        assert.equal(claims.sub, 'https://github.com/carlassmann/babyphone');
        assert.ok((await request.arrayBuffer()).byteLength > 100);
        const count = (attempts.get(url.pathname) || 0) + 1;
        attempts.set(url.pathname, count);
        return new WorkerResponse(null, {
          status: url.pathname === '/gone' ? 410 : count === 1 ? 503 : 201,
        });
      },
    });
    options.resourcePersistencePath = directory;
    options.unsafeInspectDurableObjects = true;
    let runtime = new Miniflare(options);
    const post = (path: string, body: object) =>
      runtime.dispatchFetch('http://localhost/api/' + path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    const register = async (body: object) => {
      const response = await post('register', body);
      assert.equal(response.status, 200);
      return (await response.json()) as Session;
    };
    const sockets: { close(): void }[] = [];
    async function connect(session: Session) {
      const response = await runtime.dispatchFetch(
        'http://localhost/api/ws?roomId=' + session.roomId,
        { headers: { Upgrade: 'websocket' } },
      );
      assert.equal(response.status, 101);
      const socket = response.webSocket!;
      const messages: any[] = [];
      socket.accept();
      sockets.push(socket);
      socket.addEventListener('message', (event) => messages.push(JSON.parse(String(event.data))));
      socket.send(JSON.stringify({ type: 'hello', ...session }));
      await eventually(async () => messages.some((message) => message.type === 'ready'));
      return {
        socket,
        messages,
        send: (message: object) =>
          socket.send(JSON.stringify({ ...message, token: session.token })),
      };
    }
    try {
      const baby = await register({ name: 'Nursery', role: 'baby' });
      const legacyStorage = await runtime.unsafeGetDurableObjectStorage('pip-test', 'Room', {
        id: baby.roomId,
      });
      await legacyStorage.exec("DELETE FROM records WHERE kind = 'room' AND id = 'invitation'");
      assert.equal(
        (
          await post('register', {
            name: 'Forged invite',
            role: 'parent',
            roomKey: baby.roomId + '.' + 'a'.repeat(24),
          })
        ).status,
        403,
      );
      const parent = await register({ name: 'Mom', role: 'parent', roomKey: baby.roomKey });
      const second = await register({ name: 'Dad', role: 'parent', roomKey: baby.roomKey });
      const outsider = await register({ name: 'Other room', role: 'parent' });
      for (let index = 0; index < 6; index++)
        await register({ name: 'Extra ' + index, role: 'parent', roomKey: baby.roomKey });
      assert.equal(
        (await post('sensitivity', { ...parent, target: baby.deviceId, sensitivity: 3 })).status,
        200,
      );
      assert.equal(
        (await post('sensitivity', { ...outsider, target: baby.deviceId, sensitivity: 1 })).status,
        403,
      );
      assert.equal(
        (await post('sensitivity', { ...second, target: baby.deviceId, sensitivity: 1 })).status,
        200,
      );
      assert.equal(
        (await post('sensitivity', { ...parent, target: baby.deviceId, sensitivity: 9 })).status,
        400,
      );

      assert.equal(
        (await post('register', { name: 'Intruder', role: 'parent', roomKey: 'invalid' })).status,
        404,
      );
      assert.equal((await post('state', { ...parent, roomId: outsider.roomId })).status, 401);
      assert.equal((await post('ice', { ...parent, token: 'wrong' })).status, 401);
      assert.equal(turnRequests, 0);
      const ice = await (await post('ice', parent)).json();
      assert.equal(JSON.stringify(ice).includes('server-secret'), false);
      assert.equal(JSON.stringify(ice).includes(':53'), false);
      await post('ice', parent);
      assert.equal(turnRequests, 1);
      const ecdh = createECDH('prime256v1');
      ecdh.generateKeys();
      const keys = {
        auth: randomBytes(16).toString('base64url'),
        p256dh: ecdh.getPublicKey().toString('base64url'),
      };
      assert.equal(
        (
          await post('subscription', {
            ...parent,
            subscription: { endpoint: 'http://127.0.0.1', keys },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await post('subscription', {
            ...parent,
            subscription: { endpoint: 'https://fcm.googleapis.com.evil.example', keys },
          })
        ).status,
        400,
      );
      for (const [session, path] of [
        [parent, '/retry'],
        [second, '/gone'],
      ] as const)
        assert.equal(
          (
            await post('subscription', {
              ...session,
              subscription: { endpoint: 'https://fcm.googleapis.com' + path, keys },
            })
          ).status,
          200,
        );
      const babyClient = await connect(baby);
      const parentClient = await connect(parent);
      babyClient.send({ type: 'heartbeat', monitoring: true, level: 0.2 });
      await eventually(async () =>
        parentClient.messages.some((message) =>
          message.devices?.some((device: any) => device.id === baby.deviceId && device.monitoring),
        ),
      );
      parentClient.send({
        type: 'signal',
        target: outsider.deviceId,
        payload: { kind: 'offer', callId: 'bad' },
      });
      await eventually(async () =>
        parentClient.messages.some(
          (message) => message.type === 'error' && message.message.includes('unavailable'),
        ),
      );
      parentClient.send({
        type: 'signal',
        target: baby.deviceId,
        payload: { kind: 'offer', callId: 'good' },
      });
      await eventually(async () =>
        babyClient.messages.some(
          (message) => message.type === 'signal' && message.payload.callId === 'good',
        ),
      );
      assert.equal(
        (await post('mute', { ...baby, target: baby.deviceId, muted: true })).status,
        403,
      );
      assert.equal(
        (await post('mute', { ...second, target: parent.deviceId, muted: true })).status,
        403,
      );
      assert.equal(
        (await post('mute', { ...second, target: baby.deviceId, muted: 'yes' })).status,
        400,
      );
      assert.equal(
        (await post('mute', { ...second, target: baby.deviceId, muted: true })).status,
        200,
      );
      const muted = (await (await post('state', second)).json()) as any;
      assert.deepEqual(muted.devices.find((device: any) => device.id === baby.deviceId).mutedBy, [
        second.deviceId,
      ]);
      babyClient.send({ type: 'noise' });
      babyClient.send({ type: 'noise' });
      await eventually(async () => attempts.get('/retry') === 1);
      assert.equal(attempts.get('/gone'), undefined);
      assert.equal(
        (await post('mute', { ...second, target: baby.deviceId, muted: false })).status,
        200,
      );
      const initial = (await (await post('state', parent)).json()) as any;
      assert.equal(initial.events.filter((event: any) => event.kind === 'noise').length, 1);
      assert.equal(JSON.stringify(initial).includes('tokenHash'), false);
      assert.equal(JSON.stringify(initial).includes('subscription'), false);
      for (const socket of sockets.splice(0)) {
        try {
          socket.close();
        } catch {}
      }
      await runtime.dispose();
      runtime = new Miniflare(options);
      await runtime.ready;
      const resumed = (await (await post('state', parent)).json()) as any;
      assert.equal(resumed.devices.length, 9);
      assert.equal(
        resumed.devices.find((device: any) => device.id === baby.deviceId).sensitivity,
        1,
      );
      await eventually(async () => {
        const result = (await (await post('state', parent)).json()) as any;
        return result.events.some((event: any) => event.kind === 'offline');
      });
      await eventually(async () => (attempts.get('/retry') || 0) >= 3);
      assert.equal(attempts.get('/gone'), 1);
      const storage = await runtime.unsafeGetDurableObjectStorage('pip-test', 'Room', {
        id: baby.roomId,
      });
      await eventually(
        async () =>
          (await storage.exec("SELECT id FROM records WHERE kind = 'delivery'")).length === 0,
      );
      const final = (await (await post('state', parent)).json()) as any;
      assert.equal(final.events.filter((event: any) => event.kind === 'offline').length, 1);
      assert.equal(
        final.devices.find((device: any) => device.id === baby.deviceId).monitoring,
        false,
      );
      const recovered = await connect(baby);
      recovered.send({ type: 'heartbeat', monitoring: true, level: 0.1 });
      await eventually(async () => {
        const result = (await (await post('state', parent)).json()) as any;
        return result.devices.find((device: any) => device.id === baby.deviceId).monitoring;
      });
      await runtime.unsafeEvictDurableObject('pip-test', 'Room', {
        id: baby.roomId,
        webSockets: 'hibernate',
      });
      recovered.send({ type: 'heartbeat', monitoring: false, level: 0 });
      await eventually(async () => {
        const result = (await (await post('state', parent)).json()) as any;
        return result.events.some((event: any) => event.kind === 'paused');
      });
      assert.equal((await post('clear-events', baby)).status, 403);
      assert.equal((await post('clear-events', parent)).status, 200);
      assert.equal(((await (await post('state', second)).json()) as any).events.length, 0);
      const guestConnection = await connect(second);
      let guestClosed = false;
      guestConnection.socket.addEventListener('close', () => {
        guestClosed = true;
      });
      assert.equal((await post('remove-device', { ...baby, target: baby.deviceId })).status, 400);
      assert.equal(
        (await post('remove-device', { ...outsider, target: second.deviceId })).status,
        400,
      );
      assert.equal(
        (await post('remove-device', { ...parent, target: parent.deviceId })).status,
        400,
      );
      assert.equal((await post('reset-invitation', baby)).status, 403);
      const removal = await post('remove-device', { ...baby, target: second.deviceId });
      assert.equal(removal.status, 200);
      const replacement = (await removal.json()) as { roomKey: string };
      await eventually(async () => guestClosed);
      assert.equal((await post('state', second)).status, 401);
      assert.equal((await post('ice', second)).status, 401);
      assert.equal((await post('reset-invitation', second)).status, 401);
      assert.equal(
        (await post('register', { name: 'Removed guest', role: 'parent', roomKey: baby.roomKey }))
          .status,
        403,
      );
      const invited = await register({
        name: 'New caregiver',
        role: 'parent',
        roomKey: replacement.roomKey,
      });
      assert.equal(invited.roomId, baby.roomId);
      const reset = await post('reset-invitation', parent);
      assert.equal(reset.status, 200);
      const latest = (await reset.json()) as { roomKey: string };
      assert.equal(
        (
          await post('register', {
            name: 'Old invitation',
            role: 'parent',
            roomKey: replacement.roomKey,
          })
        ).status,
        403,
      );
      assert.equal((await post('state', invited)).status, 200);
      for (const socket of sockets.splice(0)) {
        try {
          socket.close();
        } catch {}
      }
      await runtime.dispose();
      runtime = new Miniflare(options);
      await runtime.ready;
      assert.equal((await post('state', second)).status, 401);
      assert.equal(
        (await post('register', { name: 'Old invitation', role: 'parent', roomKey: baby.roomKey }))
          .status,
        403,
      );
      assert.equal(
        (await register({ name: 'After restart', role: 'parent', roomKey: latest.roomKey })).roomId,
        baby.roomId,
      );
      assert.equal((await post('rename-room', { ...baby, name: 'Not allowed' })).status, 403);
      assert.equal((await post('rename-room', { ...parent, name: '  ' })).status, 400);
      assert.equal(
        (await post('rename-device', { ...outsider, target: baby.deviceId, name: 'No' })).status,
        403,
      );
      assert.equal(
        (await post('rename-device', { ...baby, target: parent.deviceId, name: 'No' })).status,
        403,
      );
      assert.equal((await post('rename-room', { ...parent, name: 'Evening room' })).status, 200);
      assert.equal(
        (await post('rename-device', { ...parent, target: baby.deviceId, name: 'Cot phone' }))
          .status,
        200,
      );
      const renamed = (await (await post('state', baby)).json()) as any;
      assert.equal(renamed.roomName, 'Evening room');
      assert.equal(renamed.devices.find((d: any) => d.id === baby.deviceId).name, 'Cot phone');
      const activeParent = await connect(parent);
      await eventually(async () => activeParent.messages.some((m) => m.type === 'ready'));
      const subscription = { endpoint: 'https://fcm.googleapis.com/inactive', keys };
      assert.equal((await post('subscription', { ...parent, subscription })).status, 200);
      assert.equal((await post('deactivate', parent)).status, 200);
      assert.equal((await post('state', parent)).status, 200);
      assert.equal((await post('subscription', { ...parent, subscription })).status, 409);
      assert.equal((await post('test-push', parent)).status, 400);
      const reactivated = await connect(parent);
      await eventually(async () => reactivated.messages.some((m) => m.type === 'ready'));
      assert.equal((await post('subscription', { ...parent, subscription })).status, 200);
      assert.equal((await post('deactivate', baby)).status, 200);
      const inactive = (await (await post('state', parent)).json()) as any;
      assert.equal(inactive.devices.find((d: any) => d.id === baby.deviceId).monitoring, false);
      assert.equal(inactive.devices.find((d: any) => d.id === baby.deviceId).online, false);
      assert.equal((await post('leave', parent)).status, 200);
      assert.equal((await post('state', parent)).status, 401);
    } finally {
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {}
      }
      await runtime.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
