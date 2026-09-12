import { test, expect } from '@playwright/test';
test('WebKit mobile setup, microphone start, saved role, and narrow layout', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    permissions: ['microphone'],
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4310/app');
  await expect(page.getByTestId('create-room')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  expect(
    await page.locator('.app-onboarding').evaluate((el) => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
  await page.getByTestId('create-room').click();
  await page.setViewportSize({ width: 375, height: 420 });
  await page.getByTestId('device-name').fill('Small screen');
  await page.getByTestId('submit-room').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByTestId('role-baby').click();
  await page.getByTestId('device-name').fill('WebKit nursery');
  await page.getByTestId('submit-room').click();
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  await page.getByTestId('monitor-toggle').click();
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'true');
  await page.getByTestId('monitor-toggle').click();
  await page.reload();
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'false');
  await page.getByTestId('nav-settings').click();
  const lastSetting = page.getByTestId('open-privacy');
  await lastSetting.scrollIntoViewIfNeeded();
  const settingBottom = await lastSetting.evaluate(
    (element) => element.getBoundingClientRect().bottom,
  );
  const navigationTop = await page
    .locator('.room-navigation')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(settingBottom).toBeLessThan(navigationTop);
  await page.screenshot({ path: 'artifacts/baby-webkit-mobile.png', fullPage: true });
  await context.close();
});
