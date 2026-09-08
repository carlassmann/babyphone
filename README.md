# Pip

A small, audio-only baby monitor. React + TypeScript, Bun 1.4, Jazz 2.0.0-alpha.53, native WebSockets and WebRTC. Nothing has been deployed.

## Try it now

Open **http://localhost:4310**. Create a room, choose Baby, and start monitoring. Open a different browser or private window, join with the invitation code, choose Me, then Listen. Use headphones to avoid feedback when testing both sides on one computer.

The default local service stores rooms in `.data/jazz`. It does not need a Jazz Cloud account. Each browser profile remembers one device. Another tab in the same profile takes over that device and stops the old tab safely.

```sh
bun install --frozen-lockfile
bun run setup
bun run build
work up
```

`work ps`, `work logs api`, `work restart api`, and `work down` manage the processes. Keep the Mac running while testing. `work run dev` starts optional hot-reload development on port 4314.

## Two phones, without deploying

Microphone, installation, and push need a trusted HTTPS address. Plain `http://192.168…` cannot access the microphone.

```sh
bun run setup:https
bun run build
work run https
```

The script prints your LAN address. At creation it was **https://192.168.0.78:4312**. Both devices must be on the same Wi-Fi. Regenerate the server certificate if the Mac's IP changes.

Trust the development certificate on each test device first. The script creates a private local CA but does not change system trust settings.

1. Transfer `public/pip-local-ca.crt` to the phone, or download it from `http://192.168.0.78:4310/pip-local-ca.crt` on your own network.
2. On iPhone/iPad, install the downloaded profile in Settings → General → VPN & Device Management. Then enable this CA under General → About → Certificate Trust Settings.
3. On Android, install it as a CA certificate in your device's certificate/security settings. On Mac, import the CA into Keychain Access and trust it for SSL.
4. Open the HTTPS address. On iPhone, Share → Add to Home Screen, then open Pip from that icon.
5. Create/join a room. Enable notifications on each parent and use **Test notification**. Repeat with Pip in the background and the phone locked.

Only distribute the `.crt`, never `.certs/ca.key` or `.certs/server.key`. Remove the development CA from devices after testing. Alternatively, use an existing trusted private HTTPS proxy pointing to port 4310. No tunnel or public hosting was started.

## What to exercise

- Baby stays plugged in, out of reach, with Pip visible. Start monitoring and check the microphone and wake-lock indicators.
- Parent sees Monitoring, presses Listen, and hears live audio. Two parents can listen at once; multiple baby devices appear separately.
- Make a sustained sound for at least 1.5 seconds. All parents should see the alert. The 20-second cooldown prevents repeated notifications.
- Disable the baby device's network. Parents should see disconnection within roughly 12–14 seconds while the local server runs. Restore it, then press Listen again.
- Pause monitoring or revoke microphone access. Parents must see monitoring stop.
- Test a background notification on your actual phones. Focus modes, browser suspension, permissions, and network conditions can delay delivery.

Pip analyzes volume, not whether a baby is crying. It never records audio. Media uses encrypted WebRTC, directly where possible. TURN relays encrypted media when configured. The backend stores room/device metadata, signal metadata for up to a minute, and alerts for up to a day. It also holds push subscriptions, which are never returned in room snapshots.

This prototype is an extra pair of ears. Keep checking on your baby.

## Networking and push

`bun run setup` generates persistent VAPID keys in ignored `.env.local`. Set a real `VAPID_SUBJECT` email before hosting. Notification subscriptions go only to recognized browser push-service hosts. A failed test notification reports an error; expired subscriptions are removed after delivery attempts.

For networks that block direct WebRTC, set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` in `.env.local`, then `work restart api`. No TURN provider was provisioned. Same-network audio is tested; cellular-to-Wi-Fi relay and physical iOS/Android delivery still need device testing.

## Vercel path

`api/server.ts` and `vercel.json` prepare the Vite frontend and Bun WebSocket endpoint. A future hosted backend uses `JAZZ_APP_ID`, `JAZZ_SERVER_URL`, `JAZZ_BACKEND_SECRET`, and `APP_ORIGIN`. Jazz holds shared state across function instances; backend reads/writes await the global tier. Direct Jazz client access is denied; the Bun API checks room/device capabilities.

Do not deploy this configuration as a reliable unattended monitor yet. Before hosting:

- Provision Jazz v2, publish this schema and backend-only permissions, and validate the native Jazz package in Vercel's Linux runtime.
- Add a durable watchdog/outbox outside the WebSocket function. Local timers stop when Vercel freezes or ends an invocation. Without that service, a disappeared baby may not trigger background push when every function is idle. Duplicate watchdog delivery must be idempotent.
- Configure TURN and test real phone background notifications and connection rotation.
- Add distributed rate limits and validate load/multi-instance timing. The local prototype's rate limits are per process.

Vercel now supports WebSockets, but connections expire and reconnects may hit different instances. [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [Bun runtime](https://vercel.com/docs/functions/runtimes/bun), [Jazz server setup](https://jazz.tools/docs/getting-started/server-setup).

## Checks

```sh
bun run check
bun test tests
bunx playwright install chromium webkit
work run preview
bun run setup:https
work run https
bun run test:e2e
```

The browser suite uses full Chromium with a real synthetic microphone input and WebRTC. It checks received audio energy, multiple parents/babies, alerts, reconnects, persistence, permission denial, role switching, HTTP isolation, offline production loading, and the browser's push event handler. Push-handler tests inject a browser push event; they do not prove delivery through Apple/Google/Mozilla to a physical phone.

See [TESTING.md](TESTING.md) for evidence and remaining device checks, and `artifacts/` for reviewed mobile/desktop screenshots. The generated mascot and icon provenance are in [ASSETS.md](ASSETS.md).
