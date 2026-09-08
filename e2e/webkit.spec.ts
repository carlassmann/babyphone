import { test, expect } from '@playwright/test';
test('WebKit mobile setup, microphone start, saved role, and narrow layout', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4310');
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Create a room' }).click();
  await page.getByRole('button', { name: 'Baby Listen for little sounds' }).click();
  await page.getByLabel('Device name').fill('WebKit nursery');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await expect(page.getByRole('button', { name: 'Pause monitoring' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause monitoring' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start monitoring' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/baby-webkit-mobile.png', fullPage: true });
  await context.close();
});
