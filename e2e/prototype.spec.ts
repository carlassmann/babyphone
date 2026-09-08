import { test, expect, type Page } from '@playwright/test';
async function create(page: Page, role: 'Baby' | 'Me', name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room' }).click();
  await page
    .getByRole('button', { name: role, exact: false })
    .filter({ has: page.locator('strong', { hasText: new RegExp(`^${role}$`) }) })
    .click();
  await page.getByLabel('Device name').fill(name);
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pip-session')!));
}
test('real baby + two parents: pairing, received audio packets, sound alert, network loss and recovery', async ({
  browser,
}) => {
  const babyContext = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 390, height: 844 },
  });
  const parentContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const secondContext = await browser.newContext();
  const baby = await babyContext.newPage();
  const parent = await parentContext.newPage();
  const second = await secondContext.newPage();
  await parent.addInitScript(() => {
    const Original = window.RTCPeerConnection;
    const peers: RTCPeerConnection[] = [];
    Object.assign(window, { observedPeers: peers });
    window.RTCPeerConnection = class extends Original {
      constructor(config?: RTCConfiguration) {
        super(config);
        peers.push(this);
      }
    };
  });
  const session = await create(baby, 'Baby', 'Nursery');
  const nurseryCard = parent
    .locator('article')
    .filter({ has: parent.getByRole('heading', { name: 'Nursery', exact: true }) });
  for (const [page, name] of [
    [parent, 'Mom'],
    [second, 'Dad'],
  ] as const) {
    await page.goto(`/#join=${session.roomKey}`);
    await page.getByLabel('Device name').fill(name);
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  }
  await baby.getByRole('button', { name: 'Start monitoring' }).click();
  await expect(baby.getByRole('button', { name: 'Pause monitoring' })).toBeVisible();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await nurseryCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(parent.getByText('Listening live', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      parent.locator('audio').evaluate((audio: HTMLAudioElement) => ({
        ready: audio.readyState,
        time: audio.currentTime,
        live: (audio.srcObject as MediaStream)?.getAudioTracks()[0]?.readyState,
      })),
    )
    .toMatchObject({ ready: 4, live: 'live' });
  const initial = await parent
    .locator('audio')
    .evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await expect
    .poll(() => parent.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(initial + 0.2);
  await expect
    .poll(() =>
      parent.evaluate(async () => {
        const peers = (window as Window & { observedPeers: RTCPeerConnection[] }).observedPeers;
        let energy = 0;
        for (const peer of peers)
          (await peer.getStats()).forEach((stat) => {
            if (stat.type === 'inbound-rtp' && stat.kind === 'audio')
              energy += stat.totalAudioEnergy || 0;
          });
        return energy;
      }),
    )
    .toBeGreaterThan(0);
  await second.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(second.getByText('Listening live', { exact: true })).toBeVisible();
  await baby.getByLabel('Sound sensitivity').fill('3');
  await parent.getByRole('button', { name: 'Activity', exact: true }).click();
  await second.getByRole('button', { name: 'Activity', exact: true }).click();
  const playingAt = await parent
    .locator('audio')
    .evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await expect
    .poll(() => parent.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(playingAt + 0.2);
  await expect(parent.getByText('A little sound', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(second.getByText('A little sound', { exact: true })).toBeVisible();
  await baby.screenshot({ path: 'artifacts/baby-mobile.png', fullPage: true });
  await parent.screenshot({ path: 'artifacts/parent-desktop.png', fullPage: true });
  await babyContext.setOffline(true);
  await expect(parent.getByText('Device disconnected', { exact: true })).toBeVisible({
    timeout: 25000,
  });
  await parent.getByRole('button', { name: 'Monitor', exact: true }).click();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await babyContext.setOffline(false);
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await nurseryCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(parent.getByText('Listening live', { exact: true })).toBeVisible();
  await baby.getByRole('button', { name: 'Pause monitoring' }).click();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await expect(parent.getByText('Monitoring paused', { exact: true }).first()).toBeVisible();
  await baby.reload();
  await expect(baby.getByRole('heading', { name: 'Our little nest' })).toBeVisible();
  await expect(baby.getByRole('button', { name: 'Start monitoring' })).toBeVisible();
  const otherBabyContext = await browser.newContext({ permissions: ['microphone'] });
  const otherBaby = await otherBabyContext.newPage();
  await otherBaby.goto(`/#join=${session.roomKey}`);
  await otherBaby.getByRole('button', { name: 'Baby Listen for little sounds' }).click();
  await otherBaby.getByLabel('Device name').fill('Bedroom');
  await otherBaby.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(otherBaby.getByText('Connected', { exact: true })).toBeVisible();
  await otherBaby.getByRole('button', { name: 'Start monitoring' }).click();
  const bedroomCard = parent
    .locator('article')
    .filter({ has: parent.getByRole('heading', { name: 'Bedroom', exact: true }) });
  await expect(parent.locator('article')).toHaveCount(2);
  await bedroomCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(bedroomCard.getByText('Listening live', { exact: true })).toBeVisible();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await otherBabyContext.close();
  await babyContext.close();
  await parentContext.close();
  await secondContext.close();
});
test('first-run layout, keyboard dialog, invalid invite and denied microphone', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/welcome-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'artifacts/welcome-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Get the app' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Join a room' }).click();
  await page.getByLabel('Invitation code').fill('invalid');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Room not found');
  await create(page, 'Baby', 'Permission test');
  await page.context().grantPermissions([], { origin: 'http://localhost:4310' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setPermission', {
    permission: { name: 'microphone' },
    setting: 'denied',
    origin: 'http://localhost:4310',
  });
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
  await expect(page.getByRole('button', { name: 'Start monitoring' })).toBeVisible();
  await page.getByRole('button', { name: 'Room settings' }).click();
  await page.getByRole('button', { name: 'Switch to parent device' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Room settings' }).click();
  await page.getByRole('button', { name: 'Leave this room' }).click();
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  await context.close();
});
