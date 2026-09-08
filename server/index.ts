import { openDatabase } from './database';
import { Monitor, RequestError, validSubscription, sendPush } from './monitor';
import { app, type Device } from '../schema';
import type { ServerWebSocket } from 'bun';
import { OFFLINE_MS, type Signal } from '../src/protocol';

const { db } = openDatabase();
const monitor = new Monitor(db, undefined, process.env.JAZZ_SERVER_URL ? 'global' : 'local');
type SocketData = {
  device?: Device;
  connectedAt: number;
  unsubs: (() => void)[];
  seen: Set<string>;
  queue: Promise<void>;
  count: number;
  window: number;
  lastMessageAt: number;
  expired: boolean;
};
const sockets = new Set<ServerWebSocket<SocketData>>();
const rate = new Map<string, { count: number; at: number }>();
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const server = Bun.serve<SocketData>({
  maxRequestBodySize: 32768,
  port: Number(process.env.API_PORT || 4311),
  hostname: '0.0.0.0',
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/api/server' && url.searchParams.has('route'))
      url.pathname = `/api/${url.searchParams.get('route')}`;
    try {
      const origin = req.headers.get('origin');
      const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0];
      const protocol =
        forwardedProtocol === 'wss'
          ? 'https'
          : forwardedProtocol === 'ws'
            ? 'http'
            : forwardedProtocol || url.protocol.slice(0, -1);
      const expected =
        process.env.APP_ORIGIN ||
        `${protocol}://${req.headers.get('x-forwarded-host') || req.headers.get('host')}`;
      if (origin && origin !== expected) return json({ error: 'Origin not allowed' }, 403);
      if (url.pathname === '/api/ws') {
        if (
          server.upgrade(req, {
            data: {
              connectedAt: Date.now(),
              unsubs: [],
              seen: new Set(),
              queue: Promise.resolve(),
              count: 0,
              window: Date.now(),
              lastMessageAt: Date.now(),
              expired: false,
            },
          })
        )
          return;
        return json({ error: 'WebSocket required' }, 400);
      }
      if (url.pathname === '/api/config')
        return json({ pushKey: process.env.VAPID_PUBLIC_KEY || null, iceServers: iceServers() });
      if (url.pathname === '/api/health') {
        await db.all(app.rooms.limit(1));
        return json({ ok: true });
      }
      if (req.method !== 'POST') return json({ error: 'Not found' }, 404);
      const bodyText = await req.text();
      if (bodyText.length > 16000) return json({ error: 'Request too large' }, 413);
      const body = JSON.parse(bodyText);
      if (url.pathname === '/api/register') {
        const ip = server.requestIP(req)?.address || 'local';
        const entry = rate.get(ip);
        if (entry && Date.now() - entry.at < 60000 && entry.count >= 30)
          throw new RequestError('Too many attempts. Try again in a minute.', 429);
        rate.set(ip, {
          count: entry && Date.now() - entry.at < 60000 ? entry.count + 1 : 1,
          at: entry?.at && Date.now() - entry.at < 60000 ? entry.at : Date.now(),
        });
        return json(await monitor.register(body));
      }
      const device = await monitor.authenticate(body.deviceId, body.token);
      if (url.pathname === '/api/subscription') {
        if (device.role !== 'parent' || !validSubscription(body.subscription))
          throw new RequestError('Invalid notification subscription.');
        await db
          .update(app.devices, device.id, { subscription: JSON.stringify(body.subscription) })
          .wait({ tier: monitor.tier });
        return json({ ok: true });
      }
      if (url.pathname === '/api/test-push') {
        if (device.role !== 'parent' || !device.subscription)
          throw new RequestError('Enable notifications first.');
        try {
          await sendPush(JSON.parse(device.subscription), {
            title: 'Pip is all ears',
            body: 'Your test notification arrived. Try this again with Pip in the background.',
            tag: 'pip-test',
          });
        } catch {
          throw new RequestError(
            'The push service could not accept this notification. Check your connection and enable notifications again.',
            502,
          );
        }
        return json({ ok: true });
      }
      if (url.pathname === '/api/role') {
        if (!['baby', 'parent'].includes(body.role)) throw new RequestError('Invalid role');
        await monitor.heartbeat(device.id, false, 0);
        await db
          .update(app.devices, device.id, { role: body.role, subscription: '' })
          .wait({ tier: monitor.tier });
        for (const ws of sockets)
          if (ws.data.device?.id === device.id) ws.close(4000, 'Role changed');
        return json({ ok: true });
      }
      if (url.pathname === '/api/leave') {
        await monitor.heartbeat(device.id, false, 0);
        await db.delete(app.devices, device.id).wait({ tier: monitor.tier });
        for (const ws of sockets) if (ws.data.device?.id === device.id) ws.close(4001, 'Left room');
        return json({ ok: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json(
        {
          error: error instanceof RequestError ? error.message : 'Could not complete that request.',
        },
        error instanceof RequestError ? error.status : 400,
      );
    }
  },
  websocket: {
    maxPayloadLength: 32768,
    open(ws) {
      sockets.add(ws);
    },
    message(ws, raw) {
      ws.data.queue = ws.data.queue
        .then(async () => {
          if (ws.data.expired) return;
          ws.data.lastMessageAt = Date.now();
          if (Date.now() - ws.data.window > 10000) {
            ws.data.count = 0;
            ws.data.window = Date.now();
          }
          if (++ws.data.count > 120) {
            ws.close(1008, 'Too many messages');
            return;
          }
          const message = JSON.parse(String(raw));
          if (!ws.data.device) {
            if (message.type !== 'hello') throw new RequestError('Authenticate first.');
            const device = await monitor.authenticate(message.deviceId, message.token);
            for (const other of sockets)
              if (other !== ws && other.data.device?.id === device.id)
                other.close(4009, 'Device open in another tab');
            ws.data.device = device;
            await monitor.heartbeat(device.id, false, 0);
            const refresh = () => {
              void monitor
                .state(device.roomId)
                .then((state) => ws.send(JSON.stringify(state)))
                .catch(() => ws.close(1011, 'Database unavailable'));
            };
            ws.data.unsubs.push(
              db.subscribeAll(app.devices.where({ roomId: device.roomId }), refresh),
            );
            ws.data.unsubs.push(
              db.subscribeAll(app.events.where({ roomId: device.roomId }), refresh),
            );
            ws.data.unsubs.push(
              db.subscribeAll(app.signals.where({ target: device.id }), ({ all }) => {
                for (const signal of all) {
                  if (ws.data.seen.has(signal.id) || signal.at < ws.data.connectedAt) continue;
                  ws.data.seen.add(signal.id);
                  ws.send(
                    JSON.stringify({
                      type: 'signal',
                      source: signal.source,
                      payload: JSON.parse(signal.payload),
                    }),
                  );
                }
                if (ws.data.seen.size > 1000) ws.data.seen.clear();
              }),
            );
            ws.send(JSON.stringify({ type: 'ready' }));
            refresh();
            return;
          }
          const device = await monitor.authenticate(
            ws.data.device.id,
            message.token || message.deviceToken || '',
          );
          if (message.type === 'heartbeat')
            await monitor.heartbeat(device.id, message.monitoring === true, Number(message.level));
          else if (message.type === 'noise') await monitor.alert(device, 'noise');
          else if (message.type === 'signal')
            await monitor.signal(device, message.target, message.payload as Signal);
          else throw new RequestError('Unknown message.');
        })
        .catch((error) => {
          ws.send(
            JSON.stringify({
              type: 'error',
              message:
                error instanceof RequestError
                  ? error.message
                  : 'Connection problem. Reconnect and try again.',
            }),
          );
        });
    },
    close(ws) {
      sockets.delete(ws);
      ws.data.unsubs.forEach((unsub) => unsub());
    },
  },
});
let sweeping = false;
setInterval(async () => {
  for (const ws of sockets) {
    if (
      (!ws.data.device && Date.now() - ws.data.connectedAt > 5000) ||
      Date.now() - ws.data.lastMessageAt > OFFLINE_MS
    ) {
      ws.data.expired = true;
      ws.close(1008, 'Heartbeat expired');
    }
  }
  if (sweeping) return;
  sweeping = true;
  try {
    await monitor.sweep();
  } catch (error) {
    console.error('Monitor watchdog failed', error);
    for (const ws of sockets) ws.close(1011, 'Watchdog unavailable');
  } finally {
    sweeping = false;
  }
}, 2000);
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL)
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  return servers;
}
console.log(`Pip monitor API listening on ${server.url}`);
export default server;
