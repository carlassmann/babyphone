import { mkdir, chmod } from 'node:fs/promises';
import webpush from 'web-push';
await mkdir('.data', { recursive: true });
if (!(await Bun.file('.env.local').exists())) {
  const keys = webpush.generateVAPIDKeys();
  await Bun.write(
    '.env.local',
    `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`,
  );
}
await chmod('.env.local', 0o600);
console.log('Local storage and push keys ready.');
