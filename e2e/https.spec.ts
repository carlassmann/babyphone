import { test, expect } from '@playwright/test';
test('local HTTPS preserves room authentication through the proxy', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  await page.goto('https://localhost:4312');
  expect(await page.evaluate(() => isSecureContext)).toBe(true);
  await page.getByRole('button', { name: 'Create a room' }).click();
  await page.getByRole('button', { name: 'Baby Listen for little sounds' }).click();
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await expect(page.getByRole('button', { name: 'Pause monitoring' })).toBeVisible();
  await context.close();
});
