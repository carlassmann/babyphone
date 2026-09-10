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
  await expect(parent.getByText('Screen wake lock unavailable.', { exact: false })).toBeVisible();
  await parent.getByRole('link', { name: 'Monitor', exact: true }).click();
  await expect(parent.getByText('Screen staying awake', { exact: true })).toBeVisible();
  await parent.evaluate(() => (window as any).observedWake.current.release());
  await expect
    .poll(() => parent.evaluate(() => (window as any).observedWake.requests))
    .toBeGreaterThan(2);
  await parent.getByLabel('Nursery sound sensitivity').fill('3');
  await expect(baby.getByLabel('Sound sensitivity')).toHaveValue('3');
  await expect(second.getByLabel('Nursery sound sensitivity')).toHaveValue('3');
  await second.getByLabel('Nursery sound sensitivity').fill('1');
  await expect(parent.getByLabel('Nursery sound sensitivity')).toHaveValue('1');
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
  await expect.poll(() => parent.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await parent.evaluate(() => (window as any).offerUpdate());
  await expect(parent.getByText('Pip update available', { exact: true })).toBeVisible();
  await expect(parent.getByText('Pause monitoring and listening before updating.')).toBeVisible();
  await expect(parent.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0);
  await second.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(second.getByText('Listening live', { exact: true })).toBeVisible();
  await baby.getByLabel('Sound sensitivity').fill('3');
  await parent.getByRole('link', { name: 'Activity', exact: true }).click();
  await second.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(parent).toHaveURL(/\/app\/activity$/);
  await parent.goBack();
  await expect(parent).toHaveURL(/\/app$/);
  await expect(parent.getByText('Listening live', { exact: true })).toBeVisible();
  await parent.goForward();
  await expect(parent).toHaveURL(/\/app\/activity$/);
  await parent.getByRole('button', { name: 'Close toast' }).click();
  const playingAt = await parent
    .locator('audio')
    .evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await expect
    .poll(() => parent.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(playingAt + 0.2);
  await expect(parent.getByText('A little sound', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(second.getByText('A little sound', { exact: true })).toBeVisible();
  await parent.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(parent.getByText('Noise detected', { exact: true })).toHaveCount(0);
  await baby.screenshot({ path: 'artifacts/baby-mobile.png', fullPage: true });
  await parent.screenshot({ path: 'artifacts/parent-desktop.png', fullPage: true });
  await babyContext.setOffline(true);
  await expect(parent.getByText('Device disconnected', { exact: true })).toBeVisible({
    timeout: 25000,
  });
  await parent.getByRole('link', { name: 'Monitor', exact: true }).click();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await babyContext.setOffline(false);
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await nurseryCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(parent.getByText('Listening live', { exact: true })).toBeVisible();
  await baby.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(
    await baby.evaluate(() =>
      (window as Window & { capturedTracks: MediaStreamTrack[] }).capturedTracks.every(
        (track) => track.readyState === 'ended',
      ),
    ),
  ).toBe(true);
  await expect(baby.getByRole('button', { name: 'Start monitoring' })).toBeVisible();
  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await expect(parent.getByText('Monitoring paused', { exact: true }).first()).toBeVisible();
  await baby.reload();
  await expect(baby.getByRole('heading', { name: 'Our little nest' })).toBeVisible();
  await expect(baby.getByRole('button', { name: 'Start monitoring' })).toBeVisible();
  await expect(baby.getByLabel('Sound sensitivity')).toHaveValue('3');
  const otherBabyContext = await browser.newContext({ permissions: ['microphone'] });
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
  await baby.getByRole('button', { name: 'Start monitoring' }).click();
  await nurseryCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(nurseryCard.getByText('Listening live', { exact: true })).toBeVisible();
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
  await expect(nurseryCard.getByRole('button', { name: 'Resume audio' })).toBeVisible();
  await expect(bedroomCard.getByText('Listening live', { exact: true })).toBeVisible();
  await nurseryCard.getByRole('button', { name: 'Resume audio' }).click();
  await expect(nurseryCard.getByText('Listening live', { exact: true })).toBeVisible();
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
  await nurseryCard.getByRole('button', { name: 'Stop listening' }).click();
  await expect(parent.locator('audio')).toHaveCount(1);
  await expect(bedroomCard.getByText('Listening live', { exact: true })).toBeVisible();
  await parent.getByRole('button', { name: 'Switch room', exact: true }).click();
  await parent.getByRole('button', { name: 'Create a room', exact: true }).click();
  await expect(parent.locator('audio')).toHaveCount(0);
  await parent.getByLabel('Room name').fill('Travel room');
  await parent.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(parent.getByRole('heading', { name: 'Travel room' })).toBeVisible();
  await parent.getByRole('button', { name: 'Switch room', exact: true }).click();
  await parent.getByRole('button', { name: /Our little nest.*Mom/ }).click();
  await expect(nurseryCard).toBeVisible();
  await expect(parent.locator('audio')).toHaveCount(0);
  const updateToast = parent.getByRole('button', { name: 'Close toast' });
  if (await updateToast.isVisible()) await updateToast.click();
  await bedroomCard.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(bedroomCard.getByText('Listening live', { exact: true })).toBeVisible();
  await baby.getByRole('button', { name: 'Pause monitoring' }).click();
  await parent.getByRole('link', { name: 'Settings', exact: true }).click();
  await parent.getByRole('button', { name: 'Switch to dark mode' }).click();
  await parent.getByRole('link', { name: 'Monitor', exact: true }).click();
  await parent.getByRole('button', { name: 'Dim screen', exact: true }).click();
  await expect(parent.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(parent.locator('html')).toHaveAttribute('data-dim', 'true');
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.screenshot({ path: 'artifacts/parent-dark-dim.png', animations: 'disabled' });

  await expect(nurseryCard.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await second.getByRole('link', { name: 'Settings', exact: true }).click();
  await second.getByRole('button', { name: 'Manage this device', exact: true }).click();
  await second.getByRole('button', { name: 'Remove Mom', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Remove Mom', exact: true })).toHaveCount(0);
  await expect(parent.getByText('Access removed', { exact: true })).toBeVisible();
  await expect(parent.locator('audio')).toHaveCount(0);
  await expect(parent.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
  await parent.getByRole('button', { name: 'Update', exact: true }).click();
  await expect.poll(() => parent.evaluate(() => (window as any).updateRequested)).toBe(true);
  await parent.reload();
  await expect(parent.getByText('Access removed', { exact: true })).toBeVisible();
  await parent.getByRole('link', { name: 'Settings', exact: true }).click();
  await parent.getByRole('button', { name: 'Manage this device', exact: true }).click();
  await parent.getByRole('button', { name: 'Leave this room', exact: false }).click();
  await parent.goto(`/#join=${session.roomKey}`);
  await parent.getByLabel('Device name').fill('Returning caregiver');
  await parent.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(parent.getByText('Invitation expired. Ask for a new link.')).toBeVisible();
  await second.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await second.getByRole('button', { name: 'Invite device', exact: true }).click();
  const afterRemoval = await second.getByLabel('Private invitation code').inputValue();
  expect(afterRemoval).not.toBe(session.roomKey);
  await second.getByRole('button', { name: 'Reset invitation link', exact: true }).click();
  await expect(second.getByLabel('Private invitation code')).not.toHaveValue(afterRemoval);
  const currentInvitation = await second.getByLabel('Private invitation code').inputValue();
  await second.screenshot({ path: 'artifacts/reset-invitation.png' });
  await parent.getByLabel('Invitation code').fill(currentInvitation);
  await parent.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(parent.getByText('Connected', { exact: true })).toBeVisible();
  await parent.getByRole('button', { name: 'Invite device', exact: true }).click();
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
  await parent.getByRole('button', { name: 'Reset invitation link', exact: true }).click();
  await resetHeld;
  const superseded = await second.getByLabel('Private invitation code').inputValue();
  await second.getByRole('button', { name: 'Reset invitation link', exact: true }).click();
  await expect(second.getByLabel('Private invitation code')).not.toHaveValue(superseded);
  const authoritativeInvitation = await second.getByLabel('Private invitation code').inputValue();
  await expect(parent.getByLabel('Private invitation code')).toHaveValue(authoritativeInvitation);
  releaseReset();
  await expect(parent.getByRole('button', { name: 'Reset invitation link' })).toBeEnabled();
  await expect(parent.getByLabel('Private invitation code')).toHaveValue(authoritativeInvitation);
  await parent.unroute('**/api/reset-invitation');
  await parent.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await parent.getByRole('link', { name: 'Settings', exact: true }).click();
  await parent.getByRole('button', { name: 'Manage this device', exact: true }).click();
  await parent.getByRole('button', { name: 'Remove Bedroom', exact: true }).click();
  await expect(otherBaby.getByText('Access removed', { exact: true })).toBeVisible();
  await expect(otherBaby.getByRole('button', { name: 'Start monitoring' })).toBeDisabled();
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
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Manage this device', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to parent device' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeVisible();
  const previous = await page.evaluate(() => JSON.parse(localStorage.getItem('pip-session')!));
  const invitationResponse = await page.request.post('/api/register', {
    data: { role: 'parent', name: 'Host', roomName: 'Caregiver handoff' },
  });
  expect(invitationResponse.ok()).toBe(true);
  const invited = await invitationResponse.json();
  await page.goto(`/#join=${invited.roomKey}`);
  await expect(page.getByRole('dialog', { name: 'Open this invitation?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep current room' }).click();
  await expect(page.getByRole('heading', { name: 'Our little nest' })).toBeVisible();
  await page.goto(`/#join=${invited.roomKey}`);
  let finishLeaving!: () => void;
  const leaving = new Promise<void>((resolve) => (finishLeaving = resolve));
  await page.route('**/api/deactivate', async (route) => {
    const response = await route.fetch();
    await leaving;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Switch room and join' }).click();
  await expect(page.getByRole('button', { name: 'Switching room…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Open this invitation?' })).toBeVisible();
  finishLeaving();
  await expect(page.getByLabel('Invitation code')).toHaveValue(invited.roomKey);
  await page.unroute('**/api/deactivate');
  await page.getByLabel('Device name').fill('Caregiver');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Caregiver handoff' })).toBeVisible();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const retained = await page.request.post('/api/state', { data: previous });
  expect(retained.status()).toBe(200);
  await page.getByRole('button', { name: 'Switch room', exact: true }).click();
  await page.getByRole('button', { name: /Our little nest.*Permission test/ }).click();
  await expect(page.getByRole('heading', { name: 'Our little nest' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const rename = page
    .locator('form')
    .filter({ has: page.getByLabel('Room name', { exact: true }) });
  await rename.getByLabel('Room name', { exact: true }).fill('Evening nursery');
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evening nursery' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Evening nursery' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch room', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Evening nursery.*Permission test/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Caregiver handoff.*Caregiver/ }).click();
  await expect(page.getByRole('heading', { name: 'Caregiver handoff' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Manage this device', exact: true }).click();
  await page.getByRole('button', { name: 'Leave this room' }).click();
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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
  await page.getByRole('button', { name: 'Switch room', exact: true }).click();
  await page.getByRole('button', { name: /Evening nursery.*Permission test/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pip-session'))).toBeNull();
  await page.getByRole('button', { name: 'Forget Evening nursery' }).click();
  await expect(page.getByRole('button', { name: /Evening nursery.*Permission test/ })).toHaveCount(
    0,
  );
  await page.request.post('/api/leave', { data: manager });
  await context.close();
});
