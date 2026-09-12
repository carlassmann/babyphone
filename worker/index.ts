import { type Env, hash, key, json, readBody, RequestError, failure } from './shared';
import { serverLocale } from './intl';
import type { Locale } from '../src/intl/locale';
export { Room } from './room';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    let locale: Locale = 'en';
    try {
      const origin = request.headers.get('origin');
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      const allowed =
        origin === url.origin ||
        (local &&
          origin &&
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):431[0-4]$/.test(
            origin,
          ));
      if (origin && !allowed) throw new RequestError('error.originNotAllowed', 403);
      if (url.pathname === '/api/health') return json({ ok: true, runtime: 'cloudflare' });
      if (url.pathname === '/api/config')
        return json({
          pushKey: env.VAPID_PUBLIC_KEY || null,
          relayConfigured: !!env.TURN_KEY_ID && !!env.TURN_KEY_API_TOKEN,
        });
      if (url.pathname === '/api/ws') {
        const roomId = url.searchParams.get('roomId') || '';
        if (!/^[a-f0-9]{64}$/.test(roomId)) throw new RequestError('error.joinAgain', 401);
        return env.ROOMS.get(env.ROOMS.idFromString(roomId)).fetch(request);
      }
      if (request.method !== 'POST') throw new RequestError('error.notFound', 404);
      const body = await readBody(request);
      locale = serverLocale(body.locale);
      if (url.pathname === '/api/register') {
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        if (
          env.REGISTRATION_LIMITER &&
          !(await env.REGISTRATION_LIMITER.limit({ key: ip })).success
        )
          throw new RequestError('error.tooManyAttempts', 429);
        if (
          body.roomKey !== undefined &&
          (typeof body.roomKey !== 'string' ||
            !/^(?:[a-f0-9]{64}\.)?[A-Za-z0-9_-]{24}$/.test(body.roomKey.trim()))
        )
          throw new RequestError('error.roomNotFoundInvite', 404);
        const roomKey = body.roomKey?.trim() || key();
        const id = roomKey.includes('.')
          ? env.ROOMS.idFromString(roomKey.split('.')[0])
          : env.ROOMS.idFromName('room:' + hash(roomKey));
        return env.ROOMS.get(id).fetch(
          new Request(request.url, {
            method: 'POST',
            body: JSON.stringify({ ...body, roomKey, create: !body.roomKey }),
          }),
        );
      }
      if (!/^[a-f0-9]{64}$/.test(body.roomId || '')) throw new RequestError('error.joinAgain', 401);
      return env.ROOMS.get(env.ROOMS.idFromString(body.roomId)).fetch(
        new Request(request.url, { method: 'POST', body: JSON.stringify(body) }),
      );
    } catch (error) {
      return failure(error, locale);
    }
  },
} satisfies ExportedHandler<Env>;
