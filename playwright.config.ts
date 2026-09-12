import { defineConfig } from '@playwright/test';
import { audioFixture } from './e2e/audio-fixture';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4310',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/webkit.spec.ts',
      use: {
        channel: 'chromium',
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${audioFixture()}`,
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
    { name: 'webkit', testMatch: '**/webkit.spec.ts', use: { browserName: 'webkit' } },
  ],
});
