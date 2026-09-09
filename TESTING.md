# Pip verification

The backend now runs on Cloudflare Workers and one SQLite-backed Durable Object per room. The former Jazz tests were replaced with a workerd integration test covering the same authorization, persistence, cooldown, and fanout behaviors, plus durable alarms and delivery retries.

## Automated checks

- TypeScript checks the browser and Worker separately.
- Vite builds the PWA; Wrangler dry-run bundles the actual Worker without deployment.
- The Bun noise-detector test covers sustained sound, silence reset, and cooldown.
- The Node/Miniflare integration test uses actual workerd and SQLite storage. It checks room isolation, device authentication, signaling, push destination validation, encrypted push request generation, temporary TURN credentials, retries, invalid subscriptions, persisted rooms, missing-heartbeat alarms across runtime restart, socket metadata after hibernation, nine-device rooms, sensitivity authorization and persistence, and activity reset authorization.
- External push and TURN HTTP responses are mocked in the integration test. No paid provider traffic is generated.
- Six Playwright tests cover HTTPS authentication, baby and two parent clients, received WebRTC audio energy, sound alerts, network loss and recovery, role changes, microphone denial, offline PWA reload, browser push event handling, HTTP authorization, and WebKit mobile layout. The Chromium room lifecycle also checks simultaneous playback from two babies, independent stop controls, parent wake-lock reacquisition using a simulated OS sentinel, shared sensitivity changes from both parents, saved sensitivity, and dark/dim appearance.

The local runtime caught two compatibility issues during this migration: forcing Wrangler's CLI onto Bun stalled requests, and Workers rejected fetch's redirect-error mode. Wrangler now uses its supported Node launcher; push fetches use manual redirect handling so credentials are never forwarded to redirected hosts.

## Native Chrome and Safari, September 8, 2026

Tested the production build through the actual desktop apps, using the computer UI and the local Wrangler/workerd backend:

- Created a room in Chrome; joined Safari and additional baby sessions on another localhost port. Devices persisted across reopening.
- Granted real browser notification permissions. Registered real FCM and Apple subscriptions. Sent encrypted Web Push through the local Worker to both providers.
- Confirmed actual delivered notifications through `ServiceWorkerRegistration.getNotifications()` in a temporary local inspection page. This inspection only read delivered notifications; it did not generate push events.
- Closed every parent-origin tab in both browsers, then closed the monitoring Chrome baby. Both browsers received the matching "Check your baby device" notification from the Durable Object heartbeat alarm. Paused-monitoring notifications also arrived.
- Captured the built-in microphone in both native Chrome and Safari. Connected Chrome baby → Safari parent and Safari baby → installed Chrome PWA. Browser UI reported live playback. The installed PWA listened to both babies simultaneously; stopping one left the other playing.
- Acquired real baby and parent wake locks. Safari sometimes rejected the initial request after reopening or microphone permission; a subsequent interaction now reacquires it. Verified both Safari roles after the fix. OS sleep itself was not forced.
- Changed sensitivity from the installed Chrome PWA and Safari parent; observed the updated value on the baby and other parent.
- Installed Pip through Chrome's native install prompt. Verified standalone launch, remembered room, light/dark and dim controls, activity rendering, and a service-worker update returning to the connected app.

Real testing found and fixed two issues: Apple rejected the reserved default VAPID contact, and failed wake-lock requests needed a retry on focus or user interaction. Push authentication failures now identify server configuration instead of advising subscription retries. Regression checks cover the default VAPID JWT contact and wake-lock recovery after an initial rejection.

Chrome's two macOS notification entries were initially disabled and were enabled for testing. Banner presentation and native notification-click navigation were not visually verified: the computer tool exposed an unrelated Notification Center widget, and macOS suppresses notifications during screen sharing. Delivered notification records were verified in both browsers. Browser processes remained running during the closed-tab test.

Both microphones and all live playback were stopped afterward. Temporary inspection pages were removed by the final build.

The final automated run passed TypeScript, the production build, the Bun noise test, the workerd integration test, and all six browser tests. The browser suite completed in 35.2 seconds.

## Before relying on the hosted app

- Test actual Cloudflare TURN issuance and force a relayed call between cellular and Wi-Fi.
- Verify push enrollment and delivery on locked physical iOS and Android devices.
- Test long listening sessions, phone background suspension, low battery, and wake-lock loss.
- Verify deployed Durable Object alarms and push retries during network interruption and deployment.
- Add TURN credential renewal for continuous listening beyond 24 hours.

No hosted deployment or physical-phone reliability claim has been made.
