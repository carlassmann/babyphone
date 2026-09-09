import { test, expect } from '@playwright/test';
test('production shell survives offline reload without claiming monitoring; browser push handler displays an alert', async ({
  browser,
}) => {
  const context = await browser.newContext({ permissions: ['notifications'] });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  let registrationId = '';
  cdp.on('ServiceWorker.workerRegistrationUpdated', (event) => {
    registrationId =
      event.registrations.find((r) => r.scopeURL === 'http://localhost:4311/')?.registrationId ||
      registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await page.goto('http://localhost:4311/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => registrationId).not.toBe('');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Create a room' }).click();
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('http://localhost:4311/app');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Our little nest' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Connection unavailable');
  await expect(page.getByText('Connected', { exact: true })).not.toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: 'http://localhost:4311',
    registrationId,
    data: JSON.stringify({
      title: 'Noise detected',
      body: 'Nursery detected a sound.',
      tag: 'test-noise',
    }),
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body }));
      }),
    )
    .toContainEqual({ title: 'Noise detected', body: 'Nursery detected a sound.' });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    (await reg.getNotifications()).forEach((n) => n.close());
  });
  await context.close();
});
