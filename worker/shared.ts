import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import type { Role, Alert } from '../src/protocol';
import type { Room } from './room';
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
export type { Alert };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const key = () => Buffer.from(randomBytes(18)).toString('base64url');
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function cleanName(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40)
    throw new RequestError('Use a name between 1 and 40 characters.');
  return value.trim();
}
export async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Request body required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16000) {
      await reader.cancel();
      throw new RequestError('Request too large', 413);
    }
    chunks.push(value);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError('Invalid request.');
  return value;
}
export function failure(error: unknown) {
  if (!(error instanceof RequestError)) console.error('Request failed', String(error));
  return json(
    { error: error instanceof RequestError ? error.message : 'Could not complete that request.' },
    error instanceof RequestError ? error.status : 400,
  );
}
