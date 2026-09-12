import { test, expect, type Page } from '@playwright/test';
async function create(page: Page, role: 'Baby' | 'Me', name: string) {
  await page.goto('/');
  await page.getByTestId('create-room').click();
  await page.getByTestId(role === 'Baby' ? 'role-baby' : 'role-parent').click();
  await page.getByTestId('device-name').fill(name);
  await page.getByTestId('submit-room').click();
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  return page.evaluate(() => JSON.parse(localStorage.getItem('pip-session')!));
}
test('real baby + two parents: pairing, received audio packets, sound alert, network loss and recovery', async ({
  browser,
}) => {
  const babyContext = await browser.newContext({
    locale: 'en-US',
    permissions: ['microphone'],
    viewport: { width: 390, height: 844 },
  });
  const parentContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const secondContext = await browser.newContext({ locale: 'en-US' });
  const baby = await babyContext.newPage();
  const parent = await parentContext.newPage();
  const second = await secondContext.newPage();
  await parent.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async (...args) => {
      const registration = await register(...args);
      const worker = Object.assign(new EventTarget(), {
        state: 'installed',
        postMessage: () => {
          (window as any).updateRequested = true;
        },
      });
      Object.assign(window, {
        offerUpdate: () => {
          Object.defineProperty(registration, 'installing', { value: worker, configurable: true });
          registration.dispatchEvent(new Event('updatefound'));
          worker.dispatchEvent(new Event('statechange'));
        },
      });
      return registration;
    };
    const wake = {
      requests: 0,
      releases: 0,
      current: null as (EventTarget & { release: () => Promise<void>; released: boolean }) | null,
    };
    Object.assign(window, { observedWake: wake });
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        async request() {
          wake.requests++;
          if (wake.requests === 1)
            throw new DOMException('Try after interaction', 'NotAllowedError');
          const lock = Object.assign(new EventTarget(), {
            released: false,
            async release() {
              if (lock.released) return;
              lock.released = true;
              wake.releases++;
              lock.dispatchEvent(new Event('release'));
            },
          });
          wake.current = lock;
          return lock;
        },
      },
    });

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
  await baby.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      Object.assign(window, { capturedTracks: stream.getTracks() });
      return stream;
    };
  });
  const session = await create(baby, 'Baby', 'Nursery');
  const nurseryCard = parent.locator(
    `[data-testid="device-card"][data-device-id="${session.deviceId}"]`,
  );
  for (const [page, name] of [
    [parent, 'Mom'],
    [second, 'Dad'],
  ] as const) {
    await page.goto(`/#join=${session.roomKey}`);
    await page.getByTestId('device-name').fill(name);
    await page.getByTestId('submit-room').click();
    await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  }
  expect(
    await parent
      .locator('.room-scroll')
      .evaluate((element) => element.getBoundingClientRect().right === innerWidth),
  ).toBe(true);
  await expect(parent.getByTestId('wake-lock-notice')).toBeVisible();
  await parent.getByTestId('nav-monitor').click();
  await expect(parent.getByTestId('wake-status')).toBeVisible();
  await parent.evaluate(() => (window as any).observedWake.current.release());
  await expect
    .poll(() => parent.evaluate(() => (window as any).observedWake.requests))
    .toBeGreaterThan(2);
  await nurseryCard.getByTestId('device-sensitivity').fill('3');
  await expect(baby.getByTestId('baby-sensitivity')).toHaveValue('3');
  await expect(second.getByTestId('device-sensitivity')).toHaveValue('3');
  await second.getByTestId('device-sensitivity').fill('1');
  await expect(nurseryCard.getByTestId('device-sensitivity')).toHaveValue('1');
  await baby.getByTestId('monitor-toggle').click();
  await expect(baby.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'true');
  await expect(nurseryCard.getByTestId('listen-toggle')).toBeEnabled();
  await nurseryCard.getByTestId('listen-toggle').click();
  await expect(nurseryCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
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
  await expect.poll(() => parent.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await parent.evaluate(() => (window as any).offerUpdate());
  await expect(parent.locator('[data-sonner-toast]')).toBeVisible();
  await expect(parent.locator('[data-sonner-toast] [data-button]')).toHaveCount(0);
  await second.getByTestId('listen-toggle').click();
  await expect(second.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await baby.getByTestId('baby-sensitivity').fill('3');
  await parent.getByTestId('nav-activity').click();
  await second.getByTestId('nav-activity').click();
  await expect(parent).toHaveURL(/\/app\/activity$/);
  await parent.goBack();
  await expect(parent).toHaveURL(/\/app$/);
  await expect(nurseryCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await parent.goForward();
  await expect(parent).toHaveURL(/\/app\/activity$/);
  await parent.locator('[data-close-button]').first().click();
  const playingAt = await parent
    .locator('audio')
    .evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await expect
    .poll(() => parent.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(playingAt + 0.2);
  await expect(parent.locator('[data-testid="activity-event"][data-kind="noise"]')).toBeVisible({
    timeout: 30000,
  });
  await expect(second.locator('[data-testid="activity-event"][data-kind="noise"]')).toBeVisible();
  await parent.getByTestId('dismiss-notice').click();
  await expect(parent.getByTestId('event-notice')).toHaveCount(0);
  await baby.screenshot({ path: 'artifacts/baby-mobile.png', fullPage: true });
  await parent.screenshot({ path: 'artifacts/parent-desktop.png', fullPage: true });
  await babyContext.setOffline(true);
  await expect(parent.locator('[data-testid="activity-event"][data-kind="offline"]')).toBeVisible({
    timeout: 25000,
  });
  await parent.getByTestId('nav-monitor').click();
  await expect(nurseryCard.getByTestId('listen-toggle')).toBeDisabled();
  await babyContext.setOffline(false);
  await expect(nurseryCard.getByTestId('listen-toggle')).toBeEnabled({ timeout: 15000 });
  await nurseryCard.getByTestId('listen-toggle').click();
  await expect(nurseryCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await baby.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(
    await baby.evaluate(() =>
      (window as Window & { capturedTracks: MediaStreamTrack[] }).capturedTracks.every(
        (track) => track.readyState === 'ended',
      ),
    ),
  ).toBe(true);
  await expect(baby.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'false');
  await expect(nurseryCard.getByTestId('listen-toggle')).toBeDisabled();
  await expect(parent.getByTestId('event-notice')).toHaveAttribute('data-kind', 'paused');
  await baby.reload();
  await expect(baby.getByTestId('room-title')).toHaveAttribute('data-room-name', session.roomName);
  await expect(baby.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'false');
  await expect(baby.getByTestId('baby-sensitivity')).toHaveValue('3');
  const otherBabyContext = await browser.newContext({
    permissions: ['microphone'],
    locale: 'en-US',
  });
  const otherBaby = await otherBabyContext.newPage();
  await otherBaby.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      Object.assign(window, { capturedTracks: stream.getTracks() });
      return stream;
    };
  });
  await otherBaby.goto(`/#join=${session.roomKey}`);
  await otherBaby.getByTestId('role-baby').click();
  await otherBaby.getByTestId('device-name').fill('Bedroom');
  await otherBaby.getByTestId('submit-room').click();
  await expect(otherBaby.getByTestId('connection-status')).toHaveAttribute(
    'data-status',
    'connected',
  );
  await otherBaby.getByTestId('monitor-toggle').click();
  const bedroomCard = parent.locator('[data-testid="device-card"][data-device-name="Bedroom"]');
  await expect(parent.getByTestId('device-card')).toHaveCount(2);
  await bedroomCard.getByTestId('listen-toggle').click();
  await expect(bedroomCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await baby.getByTestId('monitor-toggle').click();
  await nurseryCard.getByTestId('listen-toggle').click();
  await expect(nurseryCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await expect(parent.locator('audio')).toHaveCount(2);
  const playback = await parent
    .locator('audio')
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLAudioElement).currentTime),
    );
  await expect
    .poll(() =>
      parent
        .locator('audio')
        .evaluateAll(
          (elements, initial) =>
            elements.every(
              (element, index) => (element as HTMLAudioElement).currentTime > initial[index]! + 0.2,
            ),
          playback,
        ),
    )
    .toBe(true);
  await parent.locator(`audio[data-device-id="${session.deviceId}"]`).evaluate((element) => {
    (element as HTMLAudioElement).pause();
  });
  await expect(nurseryCard.getByTestId('resume-audio')).toBeVisible();
  await expect(bedroomCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await nurseryCard.getByTestId('resume-audio').click();
  await expect(nurseryCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  const resumedAt = await parent
    .locator(`audio[data-device-id="${session.deviceId}"]`)
    .evaluate((element) => (element as HTMLAudioElement).currentTime);
  await expect
    .poll(() =>
      parent
        .locator(`audio[data-device-id="${session.deviceId}"]`)
        .evaluate((element) => (element as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(resumedAt + 0.2);
  await nurseryCard.getByTestId('listen-toggle').click();
  await expect(parent.locator('audio')).toHaveCount(1);
  await expect(bedroomCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await parent.getByTestId('room-switcher').click();
  await expect(parent.getByTestId('room-switcher')).toHaveAttribute('aria-expanded', 'true');
  await parent.getByTestId('create-room-popover').click();
  await expect(parent.locator('audio')).toHaveCount(0);
  await parent.getByTestId('room-name').fill('Travel room');
  await parent.getByTestId('submit-room').click();
  await expect(parent.getByTestId('room-title')).toHaveAttribute('data-room-name', 'Travel room');
  await parent.getByTestId('room-switcher').click();
  await parent.locator('[data-testid="room-option"][data-device-name="Mom"]').click();
  await expect(nurseryCard).toBeVisible();
  await expect(parent.locator('audio')).toHaveCount(0);
  const updateToast = parent.locator('[data-close-button]').first();
  if (await updateToast.isVisible()) await updateToast.click();
  await bedroomCard.getByTestId('listen-toggle').click();
  await expect(bedroomCard.getByTestId('audio-status')).toHaveAttribute('data-status', 'live');
  await baby.getByTestId('monitor-toggle').click();
  await parent.getByTestId('nav-settings').click();
  await parent.emulateMedia({ colorScheme: 'dark' });
  await parent.getByTestId('nav-monitor').click();
  await parent.getByTestId('dim-toggle').click();
  await expect
    .poll(() => parent.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe('dark');
  await expect(parent.locator('html')).toHaveAttribute('data-dim', 'true');
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.screenshot({ path: 'artifacts/parent-dark-dim.png', animations: 'disabled' });

  await expect(nurseryCard.getByTestId('listen-toggle')).toBeDisabled();
  await second.getByTestId('nav-settings').click();
  await second
    .locator('[data-testid="device-row"][data-device-name="Mom"]')
    .getByTestId('device-remove')
    .click();
  await second.getByTestId('confirm-remove-device').click();
  await expect(second.locator('[data-testid="device-row"][data-device-name="Mom"]')).toHaveCount(0);
  await expect(parent.getByTestId('connection-status')).toHaveAttribute(
    'data-status',
    'accessRemoved',
  );
  await expect(parent.locator('audio')).toHaveCount(0);
  await expect(parent.locator('[data-sonner-toast] [data-button]')).toBeVisible();
  await parent.locator('[data-sonner-toast] [data-button]').click();
  await expect.poll(() => parent.evaluate(() => (window as any).updateRequested)).toBe(true);
  await parent.reload();
  await expect(parent.getByTestId('connection-status')).toHaveAttribute(
    'data-status',
    'accessRemoved',
  );
  await parent.getByTestId('nav-settings').click();
  await parent.getByTestId('manage-device').click();
  await parent.getByTestId('leave-room').click();
  await parent.goto(`/#join=${session.roomKey}`);
  await parent.getByTestId('device-name').fill('Returning caregiver');
  await parent.getByTestId('submit-room').click();
  await expect(parent.getByTestId('form-error')).toBeVisible();
  await second.getByTestId('invite-device').click();
  const afterRemoval = await second.getByTestId('invite-code').inputValue();
  expect(afterRemoval).not.toBe(session.roomKey);
  await second.getByTestId('reset-invitation').click();
  await expect(second.getByTestId('invite-code')).not.toHaveValue(afterRemoval);
  const currentInvitation = await second.getByTestId('invite-code').inputValue();
  await second.screenshot({ path: 'artifacts/reset-invitation.png' });
  await parent.getByTestId('invitation-code').fill(currentInvitation);
  await parent.getByTestId('submit-room').click();
  await expect(parent.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  await parent.getByTestId('invite-device').click();
  let releaseReset!: () => void;
  let resetReached!: () => void;
  const resetHeld = new Promise<void>((resolve) => (resetReached = resolve));
  const release = new Promise<void>((resolve) => (releaseReset = resolve));
  await parent.route('**/api/reset-invitation', async (route) => {
    const response = await route.fetch();
    resetReached();
    await release;
    await route.fulfill({ response });
  });
  await parent.getByTestId('reset-invitation').click();
  await resetHeld;
  const superseded = await second.getByTestId('invite-code').inputValue();
  await second.getByTestId('reset-invitation').click();
  await expect(second.getByTestId('invite-code')).not.toHaveValue(superseded);
  const authoritativeInvitation = await second.getByTestId('invite-code').inputValue();
  await expect(parent.getByTestId('invite-code')).toHaveValue(authoritativeInvitation);
  releaseReset();
  await expect(parent.getByTestId('reset-invitation')).toBeEnabled();
  await expect(parent.getByTestId('invite-code')).toHaveValue(authoritativeInvitation);
  await parent.unroute('**/api/reset-invitation');
  await parent.getByTestId('close-dialog').click();
  await parent.getByTestId('nav-settings').click();
  await parent
    .locator('[data-testid="device-row"][data-device-name="Bedroom"]')
    .getByTestId('device-remove')
    .click();
  await parent.getByTestId('confirm-remove-device').click();
  await expect(otherBaby.getByTestId('connection-status')).toHaveAttribute(
    'data-status',
    'accessRemoved',
  );
  await expect(otherBaby.getByTestId('monitor-toggle')).toBeDisabled();
  expect(
    await otherBaby.evaluate(() =>
      (window as Window & { capturedTracks: MediaStreamTrack[] }).capturedTracks.every(
        (track) => track.readyState === 'ended',
      ),
    ),
  ).toBe(true);
  await otherBabyContext.close();
  await babyContext.close();
  await parentContext.close();
  await secondContext.close();
});
test('first-run layout, keyboard dialog, invalid invite and denied microphone', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/welcome-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'artifacts/welcome-desktop.png', fullPage: true });
  await page.getByTestId('privacy').click();
  await expect(page.getByTestId('privacy-modal')).toBeVisible();
  await expect(page.getByTestId('source-code')).toHaveAttribute(
    'href',
    'https://github.com/carlassmann/babyphone',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('privacy-modal')).not.toBeVisible();
  await page.getByTestId('join-room').click();
  await page.getByTestId('invitation-code').fill('invalid');
  await page.getByTestId('submit-room').click();
  await expect(page.getByTestId('form-error')).toBeVisible();
  await create(page, 'Baby', 'Permission test');
  await page.context().grantPermissions([], { origin: 'http://localhost:4310' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setPermission', {
    permission: { name: 'microphone' },
    setting: 'denied',
    origin: 'http://localhost:4310',
  });
  await page.getByTestId('monitor-toggle').click();
  await expect(page.getByTestId('error-notice')).toBeVisible();
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('data-active', 'false');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('manage-device').click();
  await page.getByTestId('switch-role').click();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('enable-notifications')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByTestId('enable-notifications')).toBeVisible();
  const previous = await page.evaluate(() => JSON.parse(localStorage.getItem('pip-session')!));
  const invitationResponse = await page.request.post('/api/register', {
    data: { role: 'parent', name: 'Host', roomName: 'Caregiver handoff' },
  });
  expect(invitationResponse.ok()).toBe(true);
  const invited = await invitationResponse.json();
  await page.goto(`/#join=${invited.roomKey}`);
  await expect(page.getByTestId('invitation-modal')).toBeVisible();
  await page.getByTestId('invitation-keep').click();
  await expect(page.getByTestId('room-title')).toHaveAttribute('data-room-name', previous.roomName);
  await page.goto(`/#join=${invited.roomKey}`);
  let finishLeaving!: () => void;
  const leaving = new Promise<void>((resolve) => (finishLeaving = resolve));
  await page.route('**/api/deactivate', async (route) => {
    const response = await route.fetch();
    await leaving;
    await route.fulfill({ response });
  });
  await page.getByTestId('invitation-confirm').click();
  await expect(page.getByTestId('invitation-confirm')).toHaveAttribute('data-busy', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('invitation-modal')).toBeVisible();
  finishLeaving();
  await expect(page.getByTestId('invitation-code')).toHaveValue(invited.roomKey);
  await page.unroute('**/api/deactivate');
  await page.getByTestId('device-name').fill('Caregiver');
  await page.getByTestId('submit-room').click();
  await expect(page.getByTestId('room-title')).toHaveAttribute(
    'data-room-name',
    'Caregiver handoff',
  );
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
  const retained = await page.request.post('/api/state', { data: previous });
  expect(retained.status()).toBe(200);
  await page.getByTestId('room-switcher').click();
  await page.locator('[data-testid="room-option"][data-device-name="Permission test"]').click();
  await expect(page.getByTestId('room-title')).toHaveAttribute('data-room-name', previous.roomName);
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('rename-room-input').fill('Evening nursery');
  await page.getByTestId('rename-room-save').click();
  await expect(page.getByTestId('room-title')).toHaveAttribute('data-room-name', 'Evening nursery');
  await page.reload();
  await expect(page.getByTestId('room-title')).toHaveAttribute('data-room-name', 'Evening nursery');
  await page.getByTestId('room-switcher').click();
  await expect(
    page.locator(
      '[data-testid="room-option"][data-room-name="Evening nursery"][data-device-name="Permission test"]',
    ),
  ).toBeVisible();
  await page
    .locator(
      '[data-testid="room-option"][data-room-name="Caregiver handoff"][data-device-name="Caregiver"]',
    )
    .click();
  await expect(page.getByTestId('room-title')).toHaveAttribute(
    'data-room-name',
    'Caregiver handoff',
  );
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('manage-device').click();
  await page.getByTestId('leave-room').click();
  await expect(page.getByTestId('create-room')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe('dark');
  const manager = await (
    await page.request.post('/api/register', {
      data: { role: 'parent', name: 'Manager', roomKey: previous.roomKey },
    })
  ).json();
  expect(
    (
      await page.request.post('/api/remove-device', {
        data: { ...manager, target: previous.deviceId },
      })
    ).ok(),
  ).toBe(true);
  await page.getByTestId('room-switcher').click();
  await page
    .locator(
      '[data-testid="room-option"][data-room-name="Evening nursery"][data-device-name="Permission test"]',
    )
    .click();
  await expect(page.getByTestId('rooms-error')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pip-session'))).toBeNull();
  await page.locator('[data-testid="forget-room"][data-room-name="Evening nursery"]').click();
  await expect(
    page.locator('[data-testid="room-option"][data-room-name="Evening nursery"]'),
  ).toHaveCount(0);
  await page.request.post('/api/leave', { data: manager });
  await context.close();
});
