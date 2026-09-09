import { DurableObject } from 'cloudflare:workers';
import { OFFLINE_MS, type Signal } from '../src/protocol';
import {
  type Env,
  type Device,
  type Alert,
  type Delivery,
  type SocketSession,
  key,
  hash,
  json,
  readBody,
  cleanName,
  RequestError,
  failure,
} from './shared';
import { validSubscription, sendPush } from './push';

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))',
    );
  }
  private all<T>(kind: string): T[] {
    return this.ctx.storage.sql
      .exec<{ body: string }>('SELECT body FROM records WHERE kind = ?', kind)
      .toArray()
      .map((row) => JSON.parse(row.body));
  }
  private get<T>(kind: string, id: string): T | undefined {
    const row = this.ctx.storage.sql
      .exec<{ body: string }>('SELECT body FROM records WHERE kind = ? AND id = ?', kind, id)
      .toArray()[0];
    return row ? JSON.parse(row.body) : undefined;
  }
  private put(kind: string, id: string, value: unknown) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO records (kind,id,body) VALUES (?,?,?)',
      kind,
      id,
      JSON.stringify(value),
    );
  }
  private remove(kind: string, id: string) {
    this.ctx.storage.sql.exec('DELETE FROM records WHERE kind = ? AND id = ?', kind, id);
  }
  private authenticate(id: unknown, token: unknown) {
    const device = typeof id === 'string' ? this.get<Device>('device', id) : undefined;
    if (!device || typeof token !== 'string' || device.tokenHash !== hash(token))
      throw new RequestError('Device session expired. Join your room again.', 401);
    return device;
  }
  async fetch(request: Request) {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/api/ws') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
          throw new RequestError('WebSocket required');
        if (!this.get('room', 'name')) throw new RequestError('Room not found', 404);
        if (
          this.ctx
            .getWebSockets()
            .filter((socket) => !(socket.deserializeAttachment() as SocketSession).deviceId)
            .length >= 8
        )
          throw new RequestError('Too many connections', 429);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          connectedAt: Date.now(),
          lastMessageAt: Date.now(),
          revoked: false,
          count: 0,
          window: Date.now(),
        } satisfies SocketSession);
        await this.schedule();
        return new Response(null, { status: 101, webSocket: client });
      }
      const body = await readBody(request);
      if (path === '/api/register') {
        if (!['baby', 'parent'].includes(body.role))
          throw new RequestError('Choose a device role.');
        const name = cleanName(body.name);
        let roomName = this.get<string>('room', 'name');
        if (!roomName && !body.create)
          throw new RequestError('Room not found. Check your invitation code.', 404);
        const token = key();
        const device: Device = {
          id: key(),
          tokenHash: hash(token),
          name,
          role: body.role,
          lastSeen: 0,
          monitoring: false,
          level: 0,
          lastNoise: 0,
        };
        this.ctx.storage.transactionSync(() => {
          if (!roomName) {
            roomName = cleanName(body.roomName || 'Our little nest');
            this.put('room', 'name', roomName);
          }
          this.put('device', device.id, device);
        });
        this.broadcast();
        return json({
          roomId: this.ctx.id.toString(),
          roomName,
          roomKey: body.roomKey,
          token,
          deviceId: device.id,
          name,
          role: device.role,
        });
      }
      const device = this.authenticate(body.deviceId, body.token);
      if (path === '/api/state') return json(this.state());
      if (path === '/api/sensitivity') {
        const target = this.get<Device>('device', body.target);
        if (
          !target ||
          target.role !== 'baby' ||
          (device.role !== 'parent' && device.id !== target.id)
        )
          throw new RequestError('That baby device is unavailable.', 403);
        if (![1, 2, 3].includes(body.sensitivity)) throw new RequestError('Invalid sensitivity.');
        target.sensitivity = body.sensitivity;
        this.put('device', target.id, target);
        this.broadcast();
        return json({ ok: true });
      }
      if (path === '/api/clear-events') {
        if (device.role !== 'parent')
          throw new RequestError('Use a parent device to clear activity.', 403);
        this.ctx.storage.sql.exec("DELETE FROM records WHERE kind = 'event'");
        await this.schedule();
        this.broadcast();
        return json({ ok: true });
      }

      if (path === '/api/ice') return json(await this.ice(device.id));
      if (path === '/api/subscription') {
        if (device.role !== 'parent' || !validSubscription(body.subscription))
          throw new RequestError('Invalid notification subscription.');
        device.subscription = body.subscription;
        this.put('device', device.id, device);
        return json({ ok: true });
      }
      if (path === '/api/test-push') {
        if (device.role !== 'parent' || !device.subscription)
          throw new RequestError('Enable notifications first.');
        const status = await sendPush(this.env, device.subscription, {
          title: 'Pip is all ears',
          body: 'Your test notification arrived. Try this again with Pip in the background.',
          tag: 'pip-test',
        });
        if (status < 200 || status >= 300)
          throw new RequestError(
            status === 401 || status === 403
              ? 'Push server authentication failed. Check the server VAPID keys and contact URL.'
              : status === 404 || status === 410
                ? 'This notification subscription expired. Enable notifications again.'
                : 'The push service is temporarily unavailable. Try the test again.',
            502,
          );
        return json({ ok: true });
      }
      if (path === '/api/role' || path === '/api/leave') {
        if (path === '/api/role' && !['baby', 'parent'].includes(body.role))
          throw new RequestError('Invalid role');
        this.ctx.storage.transactionSync(() => {
          this.heartbeat(device, false, 0);
          if (path === '/api/leave') this.remove('device', device.id);
          else
            this.put('device', device.id, { ...device, role: body.role, subscription: undefined });
          this.remove('ice', device.id);
          for (const job of this.all<Delivery>('delivery'))
            if (job.deviceId === device.id) this.remove('delivery', job.id);
        });
        this.closeDevice(device.id, 4000, 'Device changed');
        await this.schedule();
        this.broadcast();
        return json({ ok: true });
      }
      throw new RequestError('Not found', 404);
    } catch (error) {
      return failure(error);
    }
  }
  private heartbeat(device: Device, monitoring: boolean, level: number) {
    const wasActive = device.monitoring;
    device.monitoring = device.role === 'baby' && monitoring;
    device.lastSeen = Date.now();
    device.offlineNotified = false;
    device.level =
      device.monitoring && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    this.put('device', device.id, device);
    if (wasActive && !device.monitoring) this.alert(device, 'paused');
  }
  private alert(device: Device, kind: Alert['kind']) {
    const now = Date.now();
    if (kind === 'noise') {
      if (device.role !== 'baby' || !device.monitoring || now - device.lastSeen > OFFLINE_MS)
        throw new RequestError('Start monitoring before sending an alert.');
      if (now - device.lastNoise < 20000) return;
      device.lastNoise = now;
      this.put('device', device.id, device);
    }
    const event: Alert = { id: key(), deviceId: device.id, name: device.name, kind, at: now };
    this.put('event', event.id, event);
    for (const old of this.all<Alert>('event')
      .sort((a, b) => b.at - a.at)
      .slice(30))
      this.remove('event', old.id);
    const payload = {
      title:
        kind === 'noise'
          ? 'A little sound'
          : kind === 'paused'
            ? 'Monitoring paused'
            : 'Check your baby device',
      body:
        device.name +
        (kind === 'noise'
          ? ' detected sustained noise.'
          : kind === 'paused'
            ? ' stopped monitoring.'
            : ' lost its connection. Check on your baby.'),
      tag: event.id,
    };
    for (const parent of this.all<Device>('device')) {
      if (parent.role !== 'parent' || !parent.subscription) continue;
      const id = event.id + ':' + parent.id;
      this.put('delivery', id, {
        id,
        deviceId: parent.id,
        subscription: parent.subscription,
        payload,
        expires: now + 60000,
        nextAt: now,
        attempts: 0,
      } satisfies Delivery);
    }
  }
  private state() {
    const now = Date.now();
    return {
      type: 'state',
      at: now,
      devices: this.all<Device>('device').map(
        ({ id, name, role, lastSeen, monitoring, level, lastNoise, sensitivity }) => ({
          id,
          name,
          role,
          lastSeen,
          online: now - lastSeen <= OFFLINE_MS,
          monitoring: monitoring && now - lastSeen <= OFFLINE_MS,
          level,
          lastNoise,
          sensitivity: sensitivity ?? 2,
        }),
      ),
      events: this.all<Alert>('event')
        .filter((event) => now - event.at < 86400000)
        .sort((a, b) => b.at - a.at),
    };
  }
  private broadcast() {
    const message = JSON.stringify(this.state());
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment() as SocketSession;
      if (session.deviceId && !session.revoked) this.send(socket, message);
    }
  }
  private send(socket: WebSocket, message: string) {
    try {
      socket.send(message);
    } catch {
      this.close(socket, 1011, 'Connection unavailable');
    }
  }
  private close(socket: WebSocket, code: number, reason: string) {
    const session = socket.deserializeAttachment() as SocketSession;
    session.revoked = true;
    socket.serializeAttachment(session);
    try {
      socket.close(code, reason);
    } catch {}
  }
  private closeDevice(id: string, code: number, reason: string, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except && (socket.deserializeAttachment() as SocketSession).deviceId === id)
        this.close(socket, code, reason);
    }
  }
  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    try {
      const session = socket.deserializeAttachment() as SocketSession;
      if (session.revoked) return;
      const now = Date.now();
      if (now - session.lastMessageAt > (session.deviceId ? OFFLINE_MS : 5000)) {
        this.close(socket, 1008, 'Heartbeat expired');
        return;
      }
      if (typeof raw !== 'string' || raw.length > 16000) {
        this.close(socket, 1009, 'Message too large');
        return;
      }
      if (now - session.window > 10000) {
        session.count = 0;
        session.window = now;
      }
      if (++session.count > 120) {
        this.close(socket, 1008, 'Too many messages');
        return;
      }
      const message = JSON.parse(raw);
      const device = this.authenticate(session.deviceId || message.deviceId, message.token);
      if (!session.deviceId) {
        if (message.type !== 'hello') throw new RequestError('Authenticate first.');
        this.closeDevice(device.id, 4009, 'Device open in another tab', socket);
        session.deviceId = device.id;
        this.ctx.storage.transactionSync(() => this.heartbeat(device, false, 0));
        this.send(socket, JSON.stringify({ type: 'ready' }));
      } else {
        this.ctx.storage.transactionSync(() => {
          if (message.type === 'heartbeat')
            this.heartbeat(device, message.monitoring === true, Number(message.level));
          else if (message.type === 'noise') this.alert(device, 'noise');
          else if (message.type === 'signal') this.signal(device, message.target, message.payload);
          else throw new RequestError('Unknown message.');
        });
      }
      session.lastMessageAt = now;
      socket.serializeAttachment(session);
      await this.schedule();
      this.broadcast();
    } catch (error) {
      this.send(
        socket,
        JSON.stringify({
          type: 'error',
          message:
            error instanceof RequestError
              ? error.message
              : 'Connection problem. Reconnect and try again.',
        }),
      );
      if (error instanceof RequestError && error.status === 401)
        this.close(socket, 4001, 'Session expired');
    }
  }
  async webSocketClose(socket: WebSocket, code: number, reason: string) {
    this.close(socket, [1005, 1006, 1015].includes(code) ? 1000 : code, reason);
    await this.schedule();
  }
  async webSocketError(socket: WebSocket) {
    this.close(socket, 1011, 'Connection error');
    await this.schedule();
  }
  private signal(source: Device, targetId: string, payload: Signal) {
    const target = this.get<Device>('device', targetId);
    if (!target || target.role === source.role)
      throw new RequestError('That device is unavailable.');
    if (
      !payload ||
      !['offer', 'answer', 'ice', 'stop'].includes(payload.kind) ||
      typeof payload.callId !== 'string' ||
      payload.callId.length > 100
    )
      throw new RequestError('Invalid audio connection message.');
    if (
      payload.kind === 'offer' &&
      (source.role !== 'parent' || !target.monitoring || Date.now() - target.lastSeen > OFFLINE_MS)
    )
      throw new RequestError('The baby device is not monitoring.');
    const sockets = this.ctx.getWebSockets().filter((socket) => {
      const session = socket.deserializeAttachment() as SocketSession;
      return (
        session.deviceId === targetId &&
        !session.revoked &&
        Date.now() - session.lastMessageAt <= OFFLINE_MS
      );
    });
    if (!sockets.length && ['stop', 'ice'].includes(payload.kind)) return;
    if (!sockets.length) throw new RequestError('That device is unavailable.');
    for (const socket of sockets)
      this.send(socket, JSON.stringify({ type: 'signal', source: source.id, payload }));
  }
  private async schedule() {
    const due = [
      ...this.all<Device>('device')
        .filter((d) => d.role === 'baby' && d.lastSeen > 0 && !d.offlineNotified)
        .map((d) => d.lastSeen + OFFLINE_MS + 1),
      ...this.all<Delivery>('delivery').map((d) => d.nextAt),
      ...this.all<Alert>('event').map((e) => e.at + 86400000),
      ...this.ctx
        .getWebSockets()
        .map((socket) => socket.deserializeAttachment() as SocketSession)
        .filter((s) => !s.revoked)
        .map((s) => s.lastMessageAt + (s.deviceId ? OFFLINE_MS : 5000) + 1),
    ];
    if (!due.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const next = Math.max(Date.now() + 50, Math.min(...due));
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null || next < existing) await this.ctx.storage.setAlarm(next);
  }
  async alarm() {
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      for (const device of this.all<Device>('device')) {
        if (
          device.role === 'baby' &&
          device.lastSeen > 0 &&
          !device.offlineNotified &&
          now - device.lastSeen > OFFLINE_MS
        ) {
          device.offlineNotified = true;
          device.monitoring = false;
          device.level = 0;
          this.put('device', device.id, device);
          this.alert(device, 'offline');
        }
      }
      for (const event of this.all<Alert>('event'))
        if (now - event.at >= 86400000) this.remove('event', event.id);
    });
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment() as SocketSession;
      if (now - session.lastMessageAt > (session.deviceId ? OFFLINE_MS : 5000))
        this.close(socket, 1008, 'Heartbeat expired');
    }
    this.broadcast();
    await Promise.all(
      this.all<Delivery>('delivery')
        .filter((job) => job.nextAt <= now)
        .map(async (job) => {
          const device = this.get<Device>('device', job.deviceId);
          if (
            now >= job.expires ||
            !device?.subscription ||
            JSON.stringify(device.subscription) !== JSON.stringify(job.subscription)
          ) {
            this.remove('delivery', job.id);
            return;
          }
          try {
            const status = await sendPush(this.env, job.subscription, job.payload);
            if ((status >= 200 && status < 300) || status === 404 || status === 410) {
              this.remove('delivery', job.id);
              const current = this.get<Device>('device', job.deviceId);
              if (
                (status === 404 || status === 410) &&
                current &&
                JSON.stringify(current.subscription) === JSON.stringify(job.subscription)
              ) {
                current.subscription = undefined;
                this.put('device', current.id, current);
              }
              return;
            }
            console.error('Push service rejected delivery', status);
          } catch (error) {
            console.error(
              'Push delivery unavailable; retrying',
              error instanceof Error ? error.message : 'Unknown failure',
            );
          }
          job.attempts++;
          job.nextAt = Math.min(
            job.expires,
            Date.now() + Math.min(2000 * 2 ** job.attempts, 20000),
          );
          this.put('delivery', job.id, job);
        }),
    );
    await this.schedule();
  }
  private async ice(deviceId: string) {
    if (!this.env.TURN_KEY_ID || !this.env.TURN_KEY_API_TOKEN)
      return { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
    const cached = this.get<{ at: number; iceServers: RTCIceServer[] }>('ice', deviceId);
    if (cached && Date.now() - cached.at < 300000) return { iceServers: cached.iceServers };
    const response = await fetch(
      'https://rtc.live.cloudflare.com/v1/turn/keys/' +
        encodeURIComponent(this.env.TURN_KEY_ID) +
        '/credentials/generate-ice-servers',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.env.TURN_KEY_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400, customIdentifier: deviceId }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new RequestError('Audio relay unavailable. Try again.', 502);
    const result = (await response.json()) as { iceServers: RTCIceServer[] };
    if (!Array.isArray(result.iceServers))
      throw new RequestError('Audio relay configuration unavailable.', 502);
    const iceServers = result.iceServers.map((server) => ({
      ...server,
      urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(
        (url) => !/:53(?:\?|$)/.test(url),
      ),
    }));
    this.put('ice', deviceId, { at: Date.now(), iceServers });
    return { iceServers };
  }
}
