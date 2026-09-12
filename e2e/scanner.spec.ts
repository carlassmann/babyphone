import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';

test('scan an invitation and release the camera; cancel and permission denial allow manual entry', async ({
  page,
}) => {
  const code = 'AbCdEf0123456789_abcdefgh';
  const image = await QRCode.toDataURL(code, { width: 512, margin: 4 });
  await page.addInitScript(
    ({ image }) => {
      const state = window as unknown as {
        cameraTracks: MediaStreamTrack[];
        denyCamera: boolean;
        blankCamera: boolean;
      };
      state.cameraTracks = [];
      navigator.mediaDevices.getUserMedia = async () => {
        if (state.denyCamera) throw new DOMException('Denied', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'white';
        context.fillRect(0, 0, 512, 512);
        if (!state.blankCamera) {
          const img = new Image();
          img.src = image;
          await img.decode();
          context.drawImage(img, 0, 0);
        }
        const stream = canvas.captureStream(10);
        state.cameraTracks.push(...stream.getTracks());
        return stream;
      };
    },
    { image },
  );
  await page.goto('/app/join');
  await page.getByTestId('scan-qr').click();
  await expect(page.getByTestId('invitation-code')).toHaveValue(code);
  await expect(page.getByTestId('scanner-dialog')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).cameraTracks.every(
          (track: MediaStreamTrack) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    (window as any).blankCamera = true;
  });
  await page.getByTestId('scan-qr').click();
  await expect.poll(() => page.evaluate(() => (window as any).cameraTracks.length)).toBe(2);
  await page.getByTestId('close-dialog').click();
  await expect(page).toHaveURL(/\/app\/join$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).cameraTracks.every(
          (track: MediaStreamTrack) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    (window as any).denyCamera = true;
  });
  await page.getByTestId('scan-qr').click();
  await expect(page.getByTestId('scanner-status')).toHaveAttribute('data-state', 'error');
  await page.getByTestId('close-dialog').click();
  await page.getByTestId('invitation-code').fill('manual-code');
});
