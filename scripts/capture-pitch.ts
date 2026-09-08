import { chromium } from '@playwright/test';
const origin = 'http://localhost:4310';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const parentContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const babyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
const sessions: { deviceId: string; token: string; roomKey: string }[] = [];
try {
  const parent = await parentContext.newPage();
  await parent.goto(origin);
  await parent.evaluate(() => document.fonts.ready);
  await parent.screenshot({ path: 'artifacts/pitch/welcome.png', fullPage: true });
  async function register(body: object) {
    const response = await fetch(`${origin}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('Could not create screenshot room');
    const session = await response.json(); sessions.push(session); return session;
  }
  const babySession = await register({ name: 'Nursery', roomName: 'Our little nest', role: 'baby' });
  const parentSession = await register({ name: 'My phone', role: 'parent', roomKey: babySession.roomKey });
  const baby = await babyContext.newPage();
  await baby.goto(origin);
  await baby.evaluate(session => localStorage.setItem('pip-session', JSON.stringify(session)), babySession);
  await baby.reload();
  await baby.getByText('Connected', { exact: true }).waitFor();
  await baby.bringToFront();
  await baby.getByRole('button', { name: 'Start monitoring' }).click();
  await baby.getByRole('button', { name: 'Pause monitoring' }).waitFor();
  await parent.evaluate(session => localStorage.setItem('pip-session', JSON.stringify(session)), parentSession);
  await parent.reload();
  await parent.getByRole('button', { name: 'Listen', exact: true }).click();
  await parent.getByText('Listening live', { exact: true }).waitFor();
  await parent.evaluate(() => document.fonts.ready);
  await parent.screenshot({ path: 'artifacts/pitch/parent.png', fullPage: true });
  await baby.screenshot({ path: 'artifacts/pitch/baby.png', fullPage: true });
  console.log('Captured welcome, parent listening, and baby monitoring screens. Audio source: synthetic browser microphone.');
} finally {
  await browser.close();
  for (const session of sessions) await fetch(`${origin}/api/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
}
