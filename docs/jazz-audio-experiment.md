# Archived experiment

Jazz was removed when Pip moved to Cloudflare. The commands below describe the earlier local experiment and are no longer available.

# Jazz audio experiment

This isolated experiment tests whether Jazz v2 can transport short audio recordings for Pip. Pip's existing WebRTC path is unchanged. Nothing is deployed.

Run `work run jazz-audio`, then open http://localhost:4320 in two browser windows. Click Record microphone in one and Listen to Jazz in the other. Stop recording when finished. Use `work stop jazz-audio` to discard the experiment's in-memory databases.

The server binds to loopback. This is a single-stream local experiment with no room authentication, not a deployable endpoint. The normal Pip schema and database are not used.

## Data path

Microphone → AudioWorklet → one-second mono PCM chunk → HTTP upload → writer Jazz replica → local Jazz sync server → independent reader Jazz replica → HTTP polling → Web Audio playback.

Audio is 16-bit PCM at 16 kHz, base64-encoded into a Jazz string column. This deliberately avoids codec/container compatibility during the transport experiment. HTTP polling runs every 100 ms. All database reads and writes await the global tier.

Recording uploads one chunk at a time. A slow upload causes new chunks to be dropped instead of building an upload queue. The listener skips old sequence numbers and rejects chunks older than 2.5 seconds on receipt. Playback has a 150 ms scheduling buffer.

Cleanup runs every 250 ms and deletes rows five seconds after their estimated capture start. The test verifies that neither replica returns rows after cleanup. Physical byte erasure, sync history, tombstones, backups, and hosted retention are not verified.

## Measurements

Run individually, with no other recording window open:

```sh
bun experiments/jazz-audio/measure.ts
bun experiments/jazz-audio/measure.ts --webkit
bun experiments/jazz-audio/measure.ts --slow-network
```

The browser harness uses synthetic microphone input, plays eight chunks, interrupts the parent's chunk requests for six seconds, resumes, and checks bounded age, sequence deduplication, nonzero decoded audio energy, playback completion, and deletion on both replicas. Measurements are saved under ignored `artifacts/jazz-audio/`.

Latency is estimated from the capture timestamp to the scheduled Web Audio start. It is not an acoustic speaker-to-microphone measurement. Gap measurements describe scheduling underruns, not an independent recording of speaker output.

September 8, 2026 local runs:

| Browser  | Initial chunk delay | Steady-state delay | Steady-state scheduling gaps |
| -------- | ------------------- | ------------------ | ---------------------------- |
| Chromium | 1.19 seconds        | 1.26 seconds       | None                         |
| WebKit   | 1.26 seconds        | 1.27 seconds       | None                         |

The throttled Chromium run measured 2.39 seconds initially and 2.50 seconds in steady state, with no steady-state scheduling gaps. It also skipped four chunks during the outage and ended with zero queryable rows. Throttling added 150 ms latency, 64 kB/s upload, and 128 kB/s download to the browser HTTP connections. Jazz synchronization itself still ran on localhost. An earlier throttled run did not actually interrupt requests because browser network controls conflicted; its recovery check failed. Explicitly aborting chunk requests fixed the harness, and the rerun passed.

Both unthrottled runs resumed after the six-second interruption, skipped four missing chunks, and finished with zero queryable audio rows on both replicas. Across these two runs, 40 chunks were inserted and deleted. Peak live rows were five.

Each JSON upload was about 42.75 kB, or 154 MB per recording hour, before HTTP and Jazz protocol overhead. Parent downloads add comparable payload traffic. Real compression is necessary before treating this as an efficient audio transport.

## Final decision

Pip returned to WebRTC and moved its room state, signaling, alerts, and push retries to Cloudflare Workers and Durable Objects. Cloudflare Realtime TURN provides the configured relay fallback. The experiment code and commands above were removed.

The experiment demonstrated delayed playback through Jazz, but did not establish hosted latency, long-term storage cleanup, or efficient bandwidth use. Pip does not upload or store audio snippets.
