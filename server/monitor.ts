import { createHash, randomBytes } from 'node:crypto';
import type { Db, QueryBuilder } from 'jazz-tools/backend';
import { app, type Device } from '../schema';
import { OFFLINE_MS, type Role, type Signal } from '../src/protocol';
import webpush from 'web-push';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const key = () => randomBytes(18).toString('base64url');
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export class Monitor {
  constructor(
    readonly db: Db,
    private notify = sendPush,
    readonly tier: 'local' | 'global' = 'local',
  ) {}
  read<T>(query: QueryBuilder<T>) {
    return this.db.all(query, { tier: this.tier });
  }
  async register(input: { name: string; role: Role; roomKey?: string; roomName?: string }) {
    const name = cleanName(input.name);
    if (!['baby', 'parent'].includes(input.role)) throw new RequestError('Choose a device role.');
    let roomKey = input.roomKey?.trim();
    let room;
    if (roomKey) {
      room = (await this.read(app.rooms.where({ keyHash: hash(roomKey) })))[0];
      if (!room) throw new RequestError('Room not found. Check your invitation code.', 404);
    } else {
      roomKey = key();
      room = await this.db
        .insert(app.rooms, {
          keyHash: hash(roomKey),
          name: cleanName(input.roomName || 'Our little nest'),
          createdAt: Date.now(),
        })
        .wait({ tier: this.tier });
    }
    const token = key();
    const device = await this.db
      .insert(app.devices, {
        roomId: room.id,
        tokenHash: hash(token),
        name,
        role: input.role,
        lastSeen: 0,
        monitoring: false,
        level: 0,
        lastNoise: 0,
        subscription: '',
      })
      .wait({ tier: this.tier });
    return {
      roomId: room.id,
      roomName: room.name,
      roomKey,
      token,
      deviceId: device.id,
      name,
      role: input.role,
    };
  }
  async authenticate(id: string, token: string) {
    if (!id || !token) throw new RequestError('Reconnect this device to your room.', 401);
    const device = (await this.read(app.devices.where({ id })))[0];
    if (!device || device.tokenHash !== hash(token))
      throw new RequestError('Device session expired. Join your room again.', 401);
    return device;
  }
  async heartbeat(id: string, monitoring: boolean, level: number) {
    const device = (await this.read(app.devices.where({ id })))[0];
    if (!device) return;
    const active = device.role === 'baby' && monitoring;
    await this.db
      .update(app.devices, id, {
        lastSeen: Date.now(),
        monitoring: active,
        level: active ? Math.max(0, Math.min(1, level || 0)) : 0,
      })
      .wait({ tier: this.tier });
    if (device.monitoring && !active) await this.alert(device, 'paused');
  }
  async alert(device: Device, kind: 'noise' | 'offline' | 'paused') {
    const now = Date.now();
    if (kind === 'noise') {
      if (device.role !== 'baby' || !device.monitoring)
        throw new RequestError('Start monitoring before sending an alert.');
      if (now - device.lastNoise < 20000) return;
      await this.db.update(app.devices, device.id, { lastNoise: now }).wait({ tier: this.tier });
    }
    const event = await this.db
      .insert(app.events, {
        roomId: device.roomId,
        deviceId: device.id,
        name: device.name,
        kind,
        at: now,
      })
      .wait({ tier: this.tier });
    const parents = await this.read(app.devices.where({ roomId: device.roomId, role: 'parent' }));
    await Promise.allSettled(
      parents
        .filter((p) => p.subscription)
        .map(async (parent) => {
          try {
            await this.notify(JSON.parse(parent.subscription), {
              title:
                kind === 'noise'
                  ? 'A little sound'
                  : kind === 'paused'
                    ? 'Monitoring paused'
                    : 'Check your baby device',
              body: `${device.name} ${kind === 'noise' ? 'detected sustained noise.' : kind === 'paused' ? 'stopped monitoring.' : 'lost its connection. Check on your baby.'}`,
              tag: event.id,
            });
          } catch (error) {
            if (
              (error as { statusCode?: number }).statusCode === 410 ||
              (error as { statusCode?: number }).statusCode === 404
            )
              this.db.update(app.devices, parent.id, { subscription: '' });
            else
              console.error(
                'Push delivery failed',
                error instanceof Error ? error.message : 'Unknown error',
              );
          }
        }),
    );
  }
  async sweep(now = Date.now()) {
    const devices = await this.read(app.devices);
    for (const device of devices) {
      if (device.monitoring && now - device.lastSeen > OFFLINE_MS) {
        await this.db
          .update(app.devices, device.id, { monitoring: false, level: 0 })
          .wait({ tier: this.tier });
        await this.alert(device, 'offline');
      }
    }
    for (const event of await this.read(app.events))
      if (now - event.at > 86400000) this.db.delete(app.events, event.id);
    for (const signal of await this.read(app.signals))
      if (now - signal.at > 60000) this.db.delete(app.signals, signal.id);
  }
  async signal(source: Device, targetId: string, payload: Signal) {
    const target = (await this.read(app.devices.where({ id: targetId })))[0];
    if (!target || target.roomId !== source.roomId || target.role === source.role)
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
    await this.db
      .insert(app.signals, {
        roomId: source.roomId,
        source: source.id,
        target: target.id,
        payload: JSON.stringify(payload),
        at: Date.now(),
      })
      .wait({ tier: this.tier });
  }
  async state(roomId: string) {
    const now = Date.now();
    const devices = (await this.read(app.devices.where({ roomId }))).map((d) => ({
      id: d.id,
      name: d.name,
      role: d.role,
      lastSeen: d.lastSeen,
      online: now - d.lastSeen <= OFFLINE_MS,
      monitoring: d.monitoring && now - d.lastSeen <= OFFLINE_MS,
      level: d.level,
      lastNoise: d.lastNoise,
    }));
    const events = (await this.read(app.events.where({ roomId })))
      .sort((a, b) => b.at - a.at)
      .slice(0, 30)
      .map(({ roomId: _, ...event }) => event);
    return { type: 'state' as const, devices, events, at: now };
  }
}
function cleanName(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40)
    throw new RequestError('Use a name between 1 and 40 characters.');
  return value.trim();
}
export function validSubscription(value: unknown): value is webpush.PushSubscription {
  const sub = value as webpush.PushSubscription;
  try {
    const url = new URL(sub.endpoint);
    return (
      url.protocol === 'https:' &&
      /(^|\.)(push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com|notify\.windows\.com)$/.test(
        url.hostname,
      ) &&
      typeof sub.keys?.auth === 'string' &&
      typeof sub.keys?.p256dh === 'string'
    );
  } catch {
    return false;
  }
}
export async function sendPush(subscription: webpush.PushSubscription, payload: object) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
    throw new Error('Push keys not configured');
  await webpush.sendNotification(subscription, JSON.stringify(payload), {
    timeout: 5000,
    TTL: 60,
    urgency: 'high',
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT || 'mailto:local@pip.example',
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    },
  });
}
