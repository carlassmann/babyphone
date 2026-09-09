# Pip

A private audio baby monitor PWA. React, TypeScript, and Bun tooling. Cloudflare Workers hosts the app and API. Each room has a SQLite-backed Durable Object for devices, WebSocket signaling, events, and notification retries. Live audio uses WebRTC with Cloudflare Realtime TURN as fallback.

No Jazz, Vercel, or separate database account is required. No audio is recorded or stored. Browser push delivery still goes through Apple, Google, or Mozilla's push services as required by the browser.

Pip is a working local prototype. Nothing has been deployed.

## What you can do

- Pair multiple baby and parent devices in one room without an account.
- Listen to multiple babies at once, with separate playback controls.
- Receive Web Push for sustained sound, paused monitoring, and disconnected baby devices, including when parent tabs are closed.
- Keep baby and parent screens awake while Pip is open. The app shows when the browser denies wake lock.
- Adjust each baby's saved sensitivity from any parent device.
- View and reset room activity, with up to 30 events from the last 24 hours.
- Install the PWA, switch light/dark appearance, and dim either device's screen.

Real desktop Chrome and Safari testing covered microphones, cross-browser audio, simultaneous listening, push delivery with parent tabs closed, and wake locks. Chrome installation and service-worker updates also passed. Physical locked-phone delivery and Cloudflare TURN across networks still need testing. See [test evidence](TESTING.md).

## Try locally

Prerequisites: Bun, Node 22 or newer for Wrangler, and the local `work` process manager.

```sh
bun install
bun run setup
bun run build
work up
```

Open http://localhost:4310/app. Create a room, invite a device in a separate browser or profile, choose Baby there, and start monitoring. Tap Listen on the parent. Multiple tabs in the same browser profile share one device identity.

Wrangler runs the backend in local Cloudflare workerd on port 4311, with durable storage under `.data/cloudflare`. Bun runs Vite and project scripts. Wrangler's CLI uses its supported Node launcher. Use `work restart api` after changing local secrets.

For hot reload, run `work run dev` and open http://localhost:4314/app. Port 4310 serves the built app, so rebuild after code changes.

Migrating from the Jazz prototype requires a new room. The earlier audio experiment on port 4320 is archived in [the experiment report](docs/jazz-audio-experiment.md).

Development commands:

- `work run dev`: Vite hot reload on port 4314.
- `work run preview`: production preview on port 4313.
- `work stop api`: stop the local Worker.
- `work down`: stop project processes.

## Two phones on your Wi-Fi

```sh
bun run setup:https
bun run build
work run https
```

The setup command prints the LAN URL on port 4312. Install and trust the local CA from `/pip-local-ca.crt` on each phone. On iOS, enable full trust under Settings → General → About → Certificate Trust Settings. Certificates stay local and must never be committed or deployed.

Leave the baby device plugged in, with Pip open and its screen awake. Keep the Mac running while using the local backend. Same-network audio can work without TURN; restrictive networks need relay credentials.

## Cloudflare setup

The Worker and Durable Object configuration is in `wrangler.jsonc`. The `v1` migration creates the Room class with SQLite-backed storage. Static assets come from `dist`; `/app` supports direct navigation and offline launch.

1. Sign in with `bunx wrangler login`.
2. Create a Cloudflare Realtime TURN key in the Cloudflare dashboard.
3. Add the secrets below to ignored `.dev.vars`. Use your own contact URL or email.
4. Run `bun run check`, `bun run build`, and `bun run test`. The Worker test bundles with `wrangler deploy --dry-run` and uploads nothing.
5. When ready to publish, run `bunx wrangler deploy --secrets-file .dev.vars`. This creates the Worker and supplies its secrets in the same deployment. It has not been run.
6. Open the HTTPS URL printed by Wrangler, pair fresh devices, and complete the [hosted checks](TESTING.md#before-relying-on-the-hosted-app).

For later secret changes, use `bunx wrangler secret put NAME`. Keep `.dev.vars` private.

| Secret             | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| VAPID_PUBLIC_KEY   | Browser push subscription key                   |
| VAPID_PRIVATE_KEY  | Server push signing key                         |
| VAPID_SUBJECT      | Contact URI, such as mailto:you@example.com     |
| TURN_KEY_ID        | Cloudflare Realtime TURN key ID                 |
| TURN_KEY_API_TOKEN | Server-only token for issuing relay credentials |

Use a real HTTPS contact URL or email for `VAPID_SUBJECT`; Apple rejects reserved placeholder domains such as `pip.example` with `BadJwtToken`. If omitted, Pip uses this repository's public URL.

`bun run setup` generates local VAPID keys and copies only the push settings into `.dev.vars`. Keep VAPID keys stable after devices subscribe. TURN credentials are generated only for authenticated room devices, cached for five minutes, and valid for 24 hours. New listening connections fetch configuration again. An uninterrupted session exceeding that duration needs credential renewal, which is not yet implemented.

Without TURN secrets, local audio attempts direct WebRTC using Cloudflare STUN. With secrets configured, failed credential generation is reported rather than silently omitting the relay.

## Reliability and privacy

There is no application-level device-count cap. Practical capacity depends on browser and Cloudflare limits. Parents can listen to multiple babies simultaneously, with independent playback controls. Invitation codes are random capabilities; each device also has its own token. The public room ID alone grants no access. Device tokens are stored as hashes; push subscriptions and TURN API tokens are never broadcast.

Room WebSockets use Durable Object hibernation and restore socket metadata after eviction. The baby sends a heartbeat every three seconds. A durable alarm checks missing heartbeats from connected baby devices after twelve seconds, including paused baby devices, and records a disconnect event once. Alarm scheduling and delivery are not exact deadlines.

Alert events and per-parent notification jobs are created in one SQLite transaction. Jobs survive runtime restarts, retry failures for up to sixty seconds, and stop retrying invalid push subscriptions. Retries can deliver more than once after an ambiguous response; notification tags use stable event IDs to replace duplicates. Events expire after one day and are capped at thirty per room. Activity shows every stored event, and parents can clear the log for the room. Clearing activity does not cancel notification delivery.

Pip measures sustained sound, not whether a baby is crying. It is an extra pair of ears, not a replacement for checking on your baby.

Baby sensitivity is stored per device in its room and can be changed by that baby or any parent in the room. Changes sync immediately and survive reloads. Parents request screen wake lock while the room is open, including Activity and Settings. Wake lock can still be denied or revoked by the OS; Pip displays its status and retries after release, returning to the foreground, or interacting with the screen.

Light/dark appearance and screen dimming are separate, device-local preferences. Dark mode covers the app and dialogs; dimming is available on both baby and parent screens. Both choices persist across reloads.

## Verification

```sh
bun run check
bun run build
bun run test
bun run setup:https
work up
work run https
bun run test:e2e
```

The Workers test exercises real workerd and SQLite persistence with mocked external TURN and push services. Browser tests use synthetic microphones in Chromium and WebKit. See `TESTING.md` for evidence and remaining physical-device checks.

References: [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
