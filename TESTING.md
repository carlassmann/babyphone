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

## Access management, September 9, 2026

The workerd integration test verifies parent-only removal and invitation reset, self-removal and cross-room rejection, WebSocket closure, revoked HTTP and TURN access, old-link rejection, fresh-link joining, and persistence after runtime restart. A legacy-room check rejects forged invitations containing only a known room ID and an arbitrary secret.

The browser lifecycle removes a parent during live listening, verifies playback stops and access stays revoked after reload, leaves the revoked session, rejects the old link, resets the invitation through the UI, and joins again using the new invitation. All six browser tests passed in 34.6 seconds.

## Independent QA, September 9, 2026

An independent QA agent reviewed and extended the runtime tests. Its Sol sub-agent audited backend authorization, invitation routing, removal, alarms, and retries. A separate agent reviewed media and PWA lifecycle code. The primary agent exercised the existing-room invitation flow through the browser UI.

This review found and fixed:

- Invitation links silently ignored when the device already belonged to another room. Pip now offers a room switch and preserves the invitation through leaving.
- Paused audio still labeled as live. Playback interruption now exposes Resume audio, and ended playback clears the live status.
- Late audio setup or resume completing after cancellation. Removed calls cannot restore a live status or restart their stream.
- Baby monitoring UI remaining active after pagehide stopped its microphone. UI and audio now stop together.
- Notification retries discarding an existing valid subscription. Matching VAPID subscriptions are reused.
- A late reset HTTP response overwriting a newer invitation received through the room socket. Room state is now the authoritative source of the displayed invitation.
- Dialogs missing accessible names.

Regression tests exercise paused playback, pagehide cleanup, microphone shutdown on baby removal, invitation switching and cancellation, old-session revocation, and deliberately reordered invitation-reset responses. A temporary focused diagnostic checked push subscription reuse and replacement when the VAPID key changes.

The final six-test browser suite passed in 34.7 seconds. After the final dialog Escape fix, its targeted handoff regression passed against a rebuilt app. TypeScript and the workerd integration test also passed.

A clean 180-second Chromium run used two synthetic-microphone baby devices and two parent devices. All four audio streams advanced at 18 checkpoints, both parents stayed connected, and no page errors occurred. The temporary probe was removed; results remain in ignored `artifacts/qa-soak.json`. This verifies three minutes on one Mac, not overnight or physical-phone reliability. All test microphones stopped when the browser contexts closed.

A production rebuild interrupted the first longer listening check because Wrangler watches the built assets and restarts. Room connections recovered, but playback required Listen again. Automatic resumption of live audio after connection loss is not implemented.

## TURN configuration, September 9, 2026

Cloudflare accepted the configured TURN key and token and returned HTTP 201 with temporary relay credentials. The restarted local Worker reports relay configuration active. Actual relayed audio has not been tested. Secrets remain in ignored local files.

## Before relying on the hosted app

- Force a real TURN-relayed call between cellular and Wi-Fi.
- Verify push enrollment and delivery on locked physical iOS and Android devices.
- Test long listening sessions, phone background suspension, low battery, and wake-lock loss.
- Verify deployed Durable Object alarms and push retries during network interruption and deployment.
- Add TURN credential renewal for continuous listening beyond 24 hours.

No hosted deployment or physical-phone reliability claim has been made.

## Deployed QA, September 9, 2026

Three independent GPT-5.6 Sol agents checked `https://babyphone.carlassmann.com`.

Production API checks passed for room creation, two invitation joins, cross-room isolation, invalid tokens, three authenticated WebSockets, shared sensitivity broadcasts, and a disconnected baby's offline event and stopped-monitoring state. Device removal closed its socket with code 4001, revoked HTTP access, and rotated the invitation. Reset rejected the previous invitation and allowed a fresh join. The backend probe removed its devices and temporary script. An initial offline-event timeout came from the probe also letting parent heartbeats expire; the corrected probe passed.

Browser checks passed for parent room creation, invite copy confirmation, Monitor/Activity/Settings navigation, light/dark switching, dim/brighten controls, privacy and device settings dialogs, and recovery after closing a duplicate device tab. Browser agents interfered through shared same-origin storage, so this run does not verify independent browser pairing. Their tabs were closed; disposable browser QA rooms may remain.

The primary agent verified HTTPS endpoints, manifest and service-worker responses, no-cache on the service worker, and matching production/local push configuration. Requests for local env filenames returned the HTML app shell, not env contents. All five runtime values matched local configuration, but private TURN and VAPID credentials were still plain-text Worker bindings and should be stored as Secrets.

No real relayed audio, production push delivery, native install, physical-phone background behavior, or overnight reliability was verified in this run. The available browser did not expose the microphone/notification permission flow needed for media checks. TURN credential issuance succeeds, but that does not prove a relayed audio connection. The dark-mode illustration remains an unresolved visual issue; generated transparency attempts produced RGB checkerboards and were not integrated.

## Navigation and update UI, September 9, 2026

TanStack Router now owns the monitor, activity, settings, and setup routes. The shared room layout keeps microphone capture, WebSockets, and audio playback mounted while route content changes. The six-test Chromium/WebKit suite passed in 37.1 seconds after the changes. The multi-device lifecycle verifies browser Back/Forward while receiving audio, URL changes, settings reloads, legacy invitation handoff, and existing removal/reconnect behavior.

The same lifecycle supplies a synthetic waiting-worker event to verify that the update toast offers no Update action during live listening, allows dismissal, and offers activation after playback stops. This tests the update guard, not a real browser update download. Separately, the in-app browser received and activated an actual new service worker through the toast; the room survived the reload. The toast sits above the mobile dock and does not cover desktop navigation.

Desktop light/dark and mobile layouts were visually reviewed. Unknown routes display a recovery link back to the monitor. TypeScript and the production build passed. These changes were checked locally, not deployed.


## Saved rooms and editing — September 9

TypeScript, the production build, the Bun noise test, and workerd integration tests passed. All six Chromium/WebKit browser tests passed in 39.1 seconds.

The browser lifecycle switches rooms during live audio, verifies playback stops, returns to the saved room, and resumes listening explicitly. Setup coverage checks invitation switching without revoking the previous membership, room renaming and persistence after reload, and rejection and forgetting of a revoked saved membership.

The workerd checks cover parent-only room renaming, device rename authorization and room isolation, deactivation retaining membership while disabling push, rejection of late subscription requests, reactivation and subscription attachment, and baby deactivation clearing monitoring and online status. Push delivery after switching on a physical phone remains a deployment check.


The camera invitation test decodes a real QR from a synthetic video stream, verifies code entry and track shutdown after scanning and cancellation, and checks permission denial leaves manual entry available. Chromium passed in 2.2 seconds. Physical iPhone camera scanning remains unverified.
