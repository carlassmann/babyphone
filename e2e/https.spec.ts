import { test, expect } from '@playwright/test';
test('local HTTPS preserves room authentication through the proxy', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['microphone'],
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto('https://localhost:4312');
  expect(await page.evaluate(() => isSecureContext)).toBe(true);
  await page.getByTestId('create-room').click();
  await page.getByTestId('role-baby').click();
  await page.getByTestId('submit-room').click();
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  await page.getByTestId('monitor-toggle').click();
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'true');
  await context.close();
});
