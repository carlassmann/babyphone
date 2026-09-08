# Prototype validation

Validated locally on 7 September 2026 with Bun 1.4.0, Jazz 2.0.0-alpha.53, Chromium 151 and WebKit 26.5. No hosting deployment was made.

| Check                                  | Evidence                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Persistent room and device credentials | Shut down and reopened the native Jazz context                                                                    |
| Shared backend state                   | Two independent Jazz replicas connected to a temporary local Jazz server                                          |
| Private rooms                          | Wrong room code, wrong device credential, cross-room signaling, foreign origins rejected                          |
| Audio                                  | Browser microphone fixture → WebRTC → parent audio element; positive received audio energy and advancing playback |
| Fan-out                                | Two parents listening, both receiving the same noise alert                                                        |
| Multiple babies                        | Independent Nursery and Bedroom devices; parent listens to the selected device                                    |
| Noise                                  | Sustained volume required, silence resets detection, 20-second cooldown                                           |
| Lost connection                        | Disable baby network, observe server offline event, restore network, establish live audio again                   |
| Permissions and roles                  | Denied microphone stays off; switch role, reload, leave room, reject old credentials                              |
| Offline PWA                            | Production app reloads without network and shows connection unavailable                                           |
| Browser push                           | Browser-injected push event reaches service worker and displays the expected notification                         |
| HTTPS                                  | Local certificate endpoint preserves HTTP authentication and WebSocket signaling                                  |
| WebKit                                 | Mobile setup, microphone capture, pause, remembered role, no horizontal overflow                                  |
| UI                                     | Desktop and narrow mobile screenshots reviewed in `artifacts/`                                                    |

The durable suite contains six Bun tests and six Playwright tests. Type checking and the production build pass.

## Found and fixed

- A stalled WebSocket close handshake could replay old heartbeats after network restoration. Server leases now expire, and clients replace stalled sockets immediately.
- The preview server's `Vary: Origin` header caused cached module requests to miss offline. Same-origin cached shell requests now ignore that header.
- Proxied WebSockets use `ws`/`wss` forwarded protocols; origin checks normalize them to HTTP/HTTPS.
- Early ICE candidates can arrive before an offer through synchronized state. They are buffered by call and peer.
- Autoplay refusal no longer counts as live listening. The parent gets a Resume audio control.

## Still requires physical devices / hosting

The automation browser rejected real push-service enrollment with a permission error. The UI reports failure. The server's VAPID sender and the service worker are implemented, but actual Apple/Google/Mozilla delivery has not been demonstrated on a locked physical phone. Use Enable notifications and Test notification on the installed app.

Wake-lock release/reacquisition is implemented; actual iOS backgrounding, screen locking, battery-saving modes, and long overnight runs need physical-device tests. No TURN credentials were available, so relay-required connections remain unverified.

Vercel configuration is prepared but untested remotely. An independent durable watchdog/outbox is required before hosting for unattended use. Function-local timers alone cannot guarantee an offline push after all invocations stop.
