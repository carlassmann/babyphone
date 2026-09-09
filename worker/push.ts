import webpush from 'web-push';
import type { Env } from './shared';

export function validSubscription(value: unknown): value is webpush.PushSubscription {
  const sub = value as webpush.PushSubscription;
  try {
    const url = new URL(sub.endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      /(^|\.)(push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com|notify\.windows\.com)$/.test(
        url.hostname,
      ) &&
      /^[A-Za-z0-9_-]{20,24}$/.test(sub.keys?.auth) &&
      /^[A-Za-z0-9_-]{86,90}$/.test(sub.keys?.p256dh)
    );
  } catch {
    return false;
  }
}
export async function sendPush(env: Env, subscription: webpush.PushSubscription, payload: object) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error('Push keys not configured');
  const details = webpush.generateRequestDetails(subscription, JSON.stringify(payload), {
    TTL: 60,
    urgency: 'high',
    vapidDetails: {
      subject: env.VAPID_SUBJECT || 'https://github.com/carlassmann/babyphone',
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    },
  });
  const response = await fetch(details.endpoint, {
    method: details.method,
    headers: details.headers,
    body: Uint8Array.from(details.body).buffer,
    signal: AbortSignal.timeout(5000),
    redirect: 'manual',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { reason?: unknown } | null;
    const reason =
      typeof body?.reason === 'string' && /^[A-Za-z]{1,80}$/.test(body.reason)
        ? body.reason
        : 'Unknown';
    console.error('Push rejected', response.status, reason);
  } else await response.body?.cancel();
  return response.status;
}
