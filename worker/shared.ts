import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import type { Role, Alert } from '../src/protocol';
import type { Locale } from '../src/intl/locale';
import type { Room } from './room';
import { serverError, type ServerErrorKey } from './intl';
import type { PushSubscription } from 'web-push';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  REGISTRATION_LIMITER?: RateLimit;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  OFFLINE_ALERT_MS?: string;
}
export type Device = {
  id: string;
  tokenHash: string;
  name: string;
  role: Role;
  lastSeen: number;
  monitoring: boolean;
  offlineNotified?: boolean;
  inactive?: boolean;
  level: number;
  lastNoise: number;
  sensitivity?: number;
  mutedBabies?: string[];
  locale?: Locale;
  subscription?: PushSubscription;
};
export type Delivery = {
  id: string;
  deviceId: string;
  subscription: PushSubscription;
  payload: { title: string; body: string; tag: string };
  expires: number;
  nextAt: number;
  attempts: number;
};
export type SocketSession = {
  deviceId?: string;
  connectedAt: number;
  lastMessageAt: number;
  revoked: boolean;
  count: number;
  window: number;
};

export type RequestBody = {
  create: boolean;
  deviceId: unknown;
  name: unknown;
  role: Role;
  roomId: string;
  roomKey: string;
  roomName: unknown;
  locale: unknown;
  sensitivity: number;
  muted: unknown;
  subscription: unknown;
  target: string;
  token: unknown;
};
export type { Alert };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const key = () => Buffer.from(randomBytes(18)).toString('base64url');
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export class RequestError extends Error {
  constructor(
    public key: ServerErrorKey,
    public status = 400,
  ) {
    super(serverError('en')(key));
    this.name = 'RequestError';
  }
}
export function cleanName(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40)
    throw new RequestError('error.name');
  return value.trim();
}
export async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('error.bodyRequired');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16000) {
      await reader.cancel();
      throw new RequestError('error.tooLarge', 413);
    }
    chunks.push(value);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError('error.invalidRequest');
  return value as RequestBody;
}
export function failure(error: unknown, locale: Locale = 'en') {
  if (!(error instanceof RequestError)) console.error('Request failed', String(error));
  const translate = serverError(locale);
  return json(
    { error: error instanceof RequestError ? translate(error.key) : translate('error.generic') },
    error instanceof RequestError ? error.status : 400,
  );
}
