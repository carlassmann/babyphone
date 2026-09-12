import { DurableObject } from 'cloudflare:workers';
import { OFFLINE_ALERT_MS, OFFLINE_MS, type Signal } from '../src/protocol';
import {
  type Env,
  type Device,
  type Alert,
  type Delivery,
  type RequestBody,
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
import { serverError, serverLocale, serverPush, type ServerPushKey } from './intl';
import type { Locale } from '../src/intl/locale';

const UNAUTHENTICATED_CONNECTION_LIMIT = 8;
const AUTHENTICATION_TIMEOUT_MS = 5_000;
const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 120;
const MAX_MESSAGE_BYTES = 16_000;
const NOISE_COOLDOWN_MS = 20_000;
const EVENT_RETENTION_MS = 86_400_000;
const DELIVERY_LIFETIME_MS = 60_000;
const ICE_CACHE_MS = 300_000;

function pushDeliveryError(status: number) {
  if (status === 401 || status === 403) return new RequestError('error.pushAuthFailed', 502);
  if (status === 404 || status === 410) return new RequestError('error.pushExpired', 502);
  return new RequestError('error.pushUnavailable', 502);
}

const PUSH_KEYS = {
  noise: { title: 'push.noise.title', body: 'push.noise.body' },
  paused: { title: 'push.paused.title', body: 'push.paused.body' },
  offline: { title: 'push.offline.title', body: 'push.offline.body' },
} as const satisfies Record<Alert['kind'], { title: ServerPushKey; body: ServerPushKey }>;

function alertPayload(event: Alert, locale: Locale) {
  const translate = serverPush(locale);
  const keys = PUSH_KEYS[event.kind];
  return {
    title: translate(keys.title, {}),
    body: translate(keys.body, { name: event.name }),
    tag: event.id,
  };
}

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
      throw new RequestError('error.deviceExpired', 401);
    return device;
  }
  async fetch(request: Request) {
    let locale: Locale = 'en';
    try {
      const path = new URL(request.url).pathname;
      if (path === '/api/ws') {
        return await this.openWebSocket(request);
      }
      const body = await readBody(request);
      locale = serverLocale(body.locale);
      if (path === '/api/register') {
        return this.register(body);
      }
      const device = this.authenticate(body.deviceId, body.token);
      if (device.locale !== locale) {
        device.locale = locale;
        this.put('device', device.id, device);
      }
      if (path === '/api/state') return json(this.state());
      if (path === '/api/rename-room' || path === '/api/rename-device') {
        if (path === '/api/rename-room') {
          if (device.role !== 'parent') throw new RequestError('error.renameRoom', 403);
          this.put('room', 'name', cleanName(body.name));
        } else {
          const target = this.get<Device>('device', body.target || device.id);
          if (!target || (target.id !== device.id && device.role !== 'parent'))
            throw new RequestError('error.renameDevice', 403);
          target.name = cleanName(body.name);
          this.put('device', target.id, target);
        }
        this.broadcast();
        return json({ ok: true });
      }
      if (path === '/api/deactivate') {
        this.ctx.storage.transactionSync(() => {
          this.heartbeat(device, false, 0);
          device.inactive = true;
          device.lastSeen = 0;
          device.offlineNotified = true;
          device.subscription = undefined;
          this.put('device', device.id, device);
          this.removeDeviceResources(device.id);
        });
        this.closeDevice(device.id, 4008, 'Room inactive');
        await this.schedule();
        this.broadcast();
        return json({ ok: true });
      }

      if (path === '/api/reset-invitation' || path === '/api/remove-device') {
        if (path === '/api/reset-invitation' && device.role !== 'parent')
          throw new RequestError('error.manageAccess', 403);
        const target =
          path === '/api/remove-device' ? this.get<Device>('device', body.target) : undefined;
        if (path === '/api/remove-device' && (!target || target.id === device.id))
          throw new RequestError('error.chooseOther');
        const roomKey = this.ctx.id.toString() + '.' + key();
        this.ctx.storage.transactionSync(() => {
          this.put('room', 'invitation', roomKey);
          if (target) {
            this.remove('device', target.id);
            this.removeDeviceResources(target.id);
          }
        });
        if (target) this.closeDevice(target.id, 4001, 'Access removed');
        this.broadcast();
        await this.schedule();
        return json({ roomKey });
      }

      if (path === '/api/sensitivity') {
        const target = this.get<Device>('device', body.target);
        if (
          !target ||
          target.role !== 'baby' ||
          (device.role !== 'parent' && device.id !== target.id)
        )
          throw new RequestError('error.babyUnavailable', 403);
        if (![1, 2, 3].includes(body.sensitivity)) throw new RequestError('error.sensitivity');
        target.sensitivity = body.sensitivity;
        this.put('device', target.id, target);
        this.broadcast();
        return json({ ok: true });
      }
      if (path === '/api/mute') {
        const target = this.get<Device>('device', body.target);
        if (device.role !== 'parent' || !target || target.role !== 'baby')
          throw new RequestError('error.babyUnavailable', 403);
        if (typeof body.muted !== 'boolean') throw new RequestError('error.mute');
        const muted = new Set(device.mutedBabies ?? []);
        if (body.muted) muted.add(target.id);
        else muted.delete(target.id);
        device.mutedBabies = [...muted];
        this.put('device', device.id, device);
        this.broadcast();
        return json({ ok: true });
      }
      if (path === '/api/clear-events') {
        if (device.role !== 'parent') throw new RequestError('error.clearActivity', 403);
        this.ctx.storage.sql.exec("DELETE FROM records WHERE kind = 'event'");
        await this.schedule();
        this.broadcast();
        return json({ ok: true });
      }

      if (path === '/api/ice') return json(await this.ice(device.id));
      if (path === '/api/subscription') {
        if (device.inactive) throw new RequestError('error.activateFirst', 409);
        if (device.role !== 'parent' || !validSubscription(body.subscription))
          throw new RequestError('error.subscription');
        device.subscription = body.subscription;
        this.put('device', device.id, device);
        return json({ ok: true });
      }
      if (path === '/api/test-push') {
        if (device.role !== 'parent' || !device.subscription)
          throw new RequestError('error.enableFirst');
        const translate = serverPush(locale);
        const status = await sendPush(this.env, device.subscription, {
          title: translate('push.test.title', {}),
          body: translate('push.test.body', {}),
          tag: 'pip-test',
        });
        if (status < 200 || status >= 300) throw pushDeliveryError(status);
        return json({ ok: true });
      }
      if (path === '/api/role' || path === '/api/leave') {
        if (path === '/api/role' && !['baby', 'parent'].includes(body.role))
          throw new RequestError('error.role');
        this.ctx.storage.transactionSync(() => {
          this.heartbeat(device, false, 0);
          if (path === '/api/leave') this.remove('device', device.id);
          else
            this.put('device', device.id, { ...device, role: body.role, subscription: undefined });
          this.removeDeviceResources(device.id);
        });
        this.closeDevice(device.id, 4000, 'Device changed');
        await this.schedule();
        this.broadcast();
        return json({ ok: true });
      }
      throw new RequestError('error.notFound', 404);
    } catch (error) {
      return failure(error, locale);
    }
  }

  private async openWebSocket(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      throw new RequestError('error.websocket');
    }
    if (!this.get('room', 'name')) throw new RequestError('error.roomNotFound', 404);

    const unauthenticatedConnections = this.ctx
      .getWebSockets()
      .filter((socket) => !(socket.deserializeAttachment() as SocketSession).deviceId);
    if (unauthenticatedConnections.length >= UNAUTHENTICATED_CONNECTION_LIMIT) {
      throw new RequestError('error.tooManyConnections', 429);
    }

    const [client, server] = Object.values(new WebSocketPair());
    const now = Date.now();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      connectedAt: now,
      lastMessageAt: now,
      revoked: false,
      count: 0,
      window: now,
    } satisfies SocketSession);
    await this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  private register(body: RequestBody) {
    if (!['baby', 'parent'].includes(body.role)) {
      throw new RequestError('error.chooseRole');
    }

    const name = cleanName(body.name);
    let roomName = this.get<string>('room', 'name');
    if (!roomName && !body.create) {
      throw new RequestError('error.roomNotFoundInvite', 404);
    }

    const invitation = this.get<string>('room', 'invitation');
    const validLegacyInvitation =
      typeof body.roomKey === 'string' &&
      !body.roomKey.includes('.') &&
      this.env.ROOMS.idFromName('room:' + hash(body.roomKey)).toString() === this.ctx.id.toString();
    if (invitation ? invitation !== body.roomKey : !validLegacyInvitation) {
      throw new RequestError('error.invitationExpired', 403);
    }

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
      locale: serverLocale(body.locale),
    };
    this.ctx.storage.transactionSync(() => {
      if (!roomName) {
        roomName = cleanName(body.roomName || 'Our little nest');
        this.put('room', 'name', roomName);
      }
      if (!invitation) this.put('room', 'invitation', body.roomKey);
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

  private removeDeviceResources(deviceId: string) {
    this.remove('ice', deviceId);
    for (const delivery of this.all<Delivery>('delivery')) {
      if (delivery.deviceId === deviceId) this.remove('delivery', delivery.id);
    }
  }
  private alert(device: Device, kind: Alert['kind']) {
    const now = Date.now();
    if (kind === 'noise') {
      if (device.role !== 'baby' || !device.monitoring || now - device.lastSeen > OFFLINE_MS)
        throw new RequestError('error.startMonitoring');
      if (now - device.lastNoise < NOISE_COOLDOWN_MS) return;
      device.lastNoise = now;
      this.put('device', device.id, device);
    }
    const event: Alert = { id: key(), deviceId: device.id, name: device.name, kind, at: now };
    this.put('event', event.id, event);
    for (const old of this.all<Alert>('event')
      .sort((a, b) => b.at - a.at)
      .slice(30))
      this.remove('event', old.id);
    for (const parent of this.all<Device>('device')) {
      if (parent.role !== 'parent' || !parent.subscription) continue;
      if (parent.mutedBabies?.includes(device.id)) continue;
      const id = event.id + ':' + parent.id;
      this.put('delivery', id, {
        id,
        deviceId: parent.id,
        subscription: parent.subscription,
        payload: alertPayload(event, parent.locale ?? 'en'),
        expires: now + DELIVERY_LIFETIME_MS,
        nextAt: now,
        attempts: 0,
      } satisfies Delivery);
    }
  }
  private state() {
    const now = Date.now();
    const devices = this.all<Device>('device');
    const mutedBy = (babyId: string) =>
      devices
        .filter((parent) => parent.role === 'parent' && parent.mutedBabies?.includes(babyId))
        .map((parent) => parent.id);
    return {
      type: 'state',
      roomKey: this.get<string>('room', 'invitation'),
      roomName: this.get<string>('room', 'name'),
      at: now,
      devices: devices.map(
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
          mutedBy: role === 'baby' ? mutedBy(id) : [],
        }),
      ),
      events: this.all<Alert>('event')
        .filter((event) => now - event.at < EVENT_RETENTION_MS)
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
    let locale: Locale = 'en';
    try {
      const session = socket.deserializeAttachment() as SocketSession;
      if (session.revoked) return;
      const now = Date.now();
      if (
        now - session.lastMessageAt >
        (session.deviceId ? OFFLINE_MS : AUTHENTICATION_TIMEOUT_MS)
      ) {
        this.close(socket, 1008, 'Heartbeat expired');
        return;
      }
      if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) {
        this.close(socket, 1009, 'Message too large');
        return;
      }
      if (now - session.window > MESSAGE_WINDOW_MS) {
        session.count = 0;
        session.window = now;
      }
      if (++session.count > MESSAGE_LIMIT) {
        this.close(socket, 1008, 'Too many messages');
        return;
      }
      const message = JSON.parse(raw);
      const device = this.authenticate(session.deviceId || message.deviceId, message.token);
      locale = device.locale ?? serverLocale(message.locale);
      if (!session.deviceId) {
        if (message.type !== 'hello') throw new RequestError('error.authenticateFirst');
        this.closeDevice(device.id, 4009, 'Device open in another tab', socket);
        session.deviceId = device.id;
        this.ctx.storage.transactionSync(() => {
          device.inactive = false;
          this.heartbeat(device, false, 0);
        });
        this.send(socket, JSON.stringify({ type: 'ready' }));
      } else {
        this.ctx.storage.transactionSync(() => {
          if (message.type === 'heartbeat')
            this.heartbeat(device, message.monitoring === true, Number(message.level));
          else if (message.type === 'noise') this.alert(device, 'noise');
          else if (message.type === 'signal') this.signal(device, message.target, message.payload);
          else throw new RequestError('error.unknownMessage');
        });
      }
      session.lastMessageAt = now;
      socket.serializeAttachment(session);
      await this.schedule();
      this.broadcast();
    } catch (error) {
      const translate = serverError(locale);
      this.send(
        socket,
        JSON.stringify({
          type: 'error',
          message:
            error instanceof RequestError
              ? translate(error.key)
              : translate('error.connectionProblem'),
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
    if (!target && (payload?.kind === 'stop' || payload?.kind === 'ice')) return;
    if (!target || target.role === source.role) throw new RequestError('error.deviceUnavailable');
    if (
      !payload ||
      !['offer', 'answer', 'ice', 'stop'].includes(payload.kind) ||
      typeof payload.callId !== 'string' ||
      payload.callId.length > 100
    )
      throw new RequestError('error.audioMessage');
    if (
      payload.kind === 'offer' &&
      (source.role !== 'parent' || !target.monitoring || Date.now() - target.lastSeen > OFFLINE_MS)
    )
      throw new RequestError('error.notMonitoring');
    const sockets = this.ctx.getWebSockets().filter((socket) => {
      const session = socket.deserializeAttachment() as SocketSession;
      return (
        session.deviceId === targetId &&
        !session.revoked &&
        Date.now() - session.lastMessageAt <= OFFLINE_MS
      );
    });
    if (!sockets.length && ['stop', 'ice'].includes(payload.kind)) return;
    if (!sockets.length) throw new RequestError('error.deviceUnavailable');
    for (const socket of sockets)
      this.send(socket, JSON.stringify({ type: 'signal', source: source.id, payload }));
  }
  private offlineAlertDelay() {
    const configured = Number(this.env.OFFLINE_ALERT_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : OFFLINE_ALERT_MS;
  }
  private async schedule() {
    const due = [
      ...this.all<Device>('device')
        .filter(
          (device) => device.role === 'baby' && device.lastSeen > 0 && !device.offlineNotified,
        )
        .map((device) => device.lastSeen + this.offlineAlertDelay() + 1),
      ...this.all<Delivery>('delivery').map((delivery) => delivery.nextAt),
      ...this.all<Alert>('event').map((event) => event.at + EVENT_RETENTION_MS),
      ...this.ctx
        .getWebSockets()
        .map((socket) => socket.deserializeAttachment() as SocketSession)
        .filter((session) => !session.revoked)
        .map(
          (session) =>
            session.lastMessageAt + (session.deviceId ? OFFLINE_MS : AUTHENTICATION_TIMEOUT_MS) + 1,
        ),
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
          now - device.lastSeen > this.offlineAlertDelay()
        ) {
          device.offlineNotified = true;
          device.monitoring = false;
          device.level = 0;
          this.put('device', device.id, device);
          this.alert(device, 'offline');
        }
      }
      for (const event of this.all<Alert>('event'))
        if (now - event.at >= EVENT_RETENTION_MS) this.remove('event', event.id);
    });
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment() as SocketSession;
      if (now - session.lastMessageAt > (session.deviceId ? OFFLINE_MS : AUTHENTICATION_TIMEOUT_MS))
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
    if (cached && Date.now() - cached.at < ICE_CACHE_MS) return { iceServers: cached.iceServers };
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
    if (!response.ok) throw new RequestError('error.relayUnavailable', 502);
    const result = (await response.json()) as { iceServers: RTCIceServer[] };
    if (!Array.isArray(result.iceServers)) throw new RequestError('error.relayConfig', 502);
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
