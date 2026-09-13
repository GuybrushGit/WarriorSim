# Shared compute coordinator

Classic (`classic.html`) and Season of Discovery (`index.html`) share one
coordinator and application bundle. The resolved simulation spec selects the
game mode; each bundle hash forms its own isolated participant pool.

A participating browser contributes idle workers up to the count chosen on the panel's
**Your shared threads** slider, which runs from 2 to the machine's logical CPU count
(capped at 64) and defaults to 45% of that maximum, rounded down. A second slider,
**Your local threads**, sets how many workers the browser uses for its own simulations:
1 to the same maximum, defaulting to the maximum. Both are stored in `localStorage`
(`warriorsim.localThreads`, `warriorsim.sharedThreads`) and re-clamped to the current
machine on load. Sharing is on
by default; an explicit refusal is stored in `localStorage` under
`warriorsim.shareCompute` and is the only value that keeps it off on a later visit.
Starting any DPS, stat-weight, or gear-ranking operation synchronously terminates those workers.
The first `submit` includes both the new simulation and the canceled lease IDs.
The coordinator changes that connection to push mode, requeues **all** its
donations (including assignments still in transit), and publishes its own work
in one message handler. The browser uses all reported logical CPUs, capped at
64 workers, for its own work. Completing the foreground operation returns it to
pull mode immediately. Disabled sharing creates no connection and runs locally.

## Hosting

Use Node.js 18 or newer. Keep the existing static web host and run one coordinator
process on the same machine. It routes work and reports; it does not run combat.
It has no database, and restarting it is safe: clients keep completed chunks and
continue locally, then reconnect with the remaining work.

Build the static bundle, and run a coordinator that supports its wire protocol:

```powershell
# On the build machine with Emscripten installed:
npm run dist
```

```sh
# On the serving host, in the deployed repository:
npm ci --prefix server --omit=dev
COMPUTE_ORIGINS=https://sim.example.com npm run compute:server
```

`server/package.json` is independent of the legacy gulp dependencies. The build
creates an immutable snapshot at `dist/bundles/<buildId>/` and publishes
`dist/compute-build.json` as the pointer to the current release. The coordinator
does **not** read that pointer or require a configured current hash. Old and new
bundles can share concurrently, each within its own pool. A code/content rollout
does not require restarting the coordinator.

Upload the complete new bundle directory before atomically replacing the manifest.
Each tab preloads and verifies **every manifest asset**, including both page
variants and WASM, before initializing the simulator. It retains the bytes as
document-owned Blob URLs; page scripts and all future workers use those copies.
Once startup completes, removing the tab's old bundle directory does not affect
local simulations, sharing, parameter changes, or recreation of canceled workers.
This does not depend on the browser's HTTP cache keeping the assets available.

Keep a deployment grace period for tabs **still downloading** the previous release:
an incomplete preload fails visibly and requires a reload to select the new release.
Old directories are otherwise optional for already initialized tabs. The build
does not delete snapshots automatically, so deployment cleanup controls retention.
An inactive pool is removed from server memory when its last client disconnects,
but can be recreated by a returning client with that hash.

Serve the HTML and `dist/js/bundle-loader.min.js` with `Cache-Control: no-cache`,
the current manifest with `Cache-Control: no-store`, and immutable bundle assets
with `Cache-Control: public, max-age=31536000, immutable`. Preserve their bytes:
do not rewrite/minify CDN responses after building. `.gitattributes` disables Git
line-ending conversion within bundle directories so integrity checks survive
Windows/Linux checkouts. The loader uses Web Crypto and requires HTTPS (localhost
is supported for development). If setting a Content Security Policy, allow Blob
URLs for scripts, workers, and WASM fetches (`script-src`, `worker-src`, and
`connect-src`) as well as the existing WASM compilation and page requirements.

For the initial migration, tabs opened before this preloading loader was introduced
should reload once. Those tabs still load worker/WASM URLs lazily from the ordinary
deployment paths and cannot retain an immutable bundle identity. Subsequent
releases using this preloading loader need no reload for initialized tabs.

## Bundle identity and routing

Each page fetches the current manifest **once at startup**, computes a SHA-256
digest, and retains that hash until navigation/reload. It does not hash the selected
character or refetch the current version at simulation time or on reconnect.

The exact input is UTF-8 `JSON.stringify()` of this descriptor, in the field order
shown, with the `files` list sorted lexically by path:

```text
{
  format: 2,
  protocol: 2,
  specVersion: 1,
  entrypoints: { classic: [ordered script paths], sod: [ordered script paths] },
  files: [{ path: "js/...", sha256: "SHA-256 of that file's exact bytes" }, ...]
}
```

The build also calculates the digest to name the snapshot directory; browsers
independently calculate it and check that it matches the advertised `buildId`.
Manifest format 2 requires the preloading runtime in both pages and workers;
incompatible loader/manifest combinations fail at startup and request a reload.
The per-file digests cover **all deployed JavaScript and JSON under `dist/js`**,
including libraries, UI, serialization, RNG/report merging, workers, sharing
protocol/scheduling, and game-data catalogs (gear, enchants, buffs, spells, talents,
level stats, presets, and defaults). They also cover `warriorsim.js` and
`warriorsim.wasm`. This deliberately versions the complete application bundle;
a JavaScript-only UI change can create a new pool too. CSS, images, timestamps,
server addresses, user profiles, seeds, iteration counts, and other per-job
settings are excluded. The stable bootstrap stays outside the application bundle;
an obsolete `compute-build.min.js` marker, if present from an earlier build, is
also excluded. The manifest is the current release pointer.

Every asset's exact bytes are checked against its SHA-256 digest during preload,
before any application script executes. JavaScript then runs from retained Blob
URLs in the manifest's entrypoint order. Local and donated worker bootstraps carry
the same asset map; their script imports and WASM fetches also use retained Blob
URLs, with no further bundle requests to the web server. Only the selected page
variant's entrypoints execute, but all files are retained. The tab holds one
immutable bundle identity, even if the current release pointer changes or its
server directory is deleted. A failed startup releases any retained object URLs.
Successful tabs keep them until the document unloads (including across a browser
back/forward-cache restore). Reloading or restoring a discarded tab loads the
then-current release. This increases startup downloads and retained asset memory;
CSS, images, and external tooltips remain outside the simulation bundle.

Every protocol 2 message in **both directions**, including `hello`, work results,
claims, cancellations, finish, and mode changes, contains `buildId`. The server
binds the connection to that hash at handshake and rejects missing or changed
hashes before modifying jobs. Jobs are keyed by `(buildId, jobId)`, so different
pools may even reuse a job ID. Scheduling, leases, results, and cancellation stay
within the connection's pool. The server keeps global resource limits across
pools; advertising many hashes does not multiply those limits.
Only protocol 2 is accepted; messages cannot omit the connection's hash.

The hash is a compatibility/routing identity, not an attestation that a client
executed honest code. Future incompatible wire/schema changes must retain an
appropriate protocol handler/validator for older clients; a new content hash
alone cannot make incompatible message formats interoperable.

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address; keep it behind the HTTPS proxy |
| `PORT` | `8787` | Coordinator port |
| `COMPUTE_ORIGINS` | required | Comma-separated exact site origins, including scheme and port |
| `COMPUTE_WORKER_TOKEN` | unset | Secret bearer token for future native workers without an Origin header |

Example nginx location inside the existing HTTPS server block:

```nginx
location = /compute {
    proxy_pass http://127.0.0.1:8787/compute;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 75s;
    proxy_send_timeout 75s;
    proxy_buffering off;
}
```

The browser connects to `./compute` relative to the page. If the page is hosted
at `/WarriorSim/index.html`, use
`location = /WarriorSim/compute` and keep the upstream URL `/compute`.
TLS terminates at nginx; browsers on HTTPS use WSS automatically. The endpoint
is same-origin, so no browser API keys or cross-origin credentials are needed.
The static-only GitHub Pages deployment remains usable with local execution.

Example systemd unit (adapt the paths and service account):

```ini
[Unit]
Description=WarriorSim compute coordinator
After=network.target

[Service]
Type=simple
User=warriorsim
WorkingDirectory=/srv/warriorsim
ExecStart=/usr/bin/node /srv/warriorsim/server/index.js
EnvironmentFile=/etc/warriorsim-compute.env
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

Put `COMPUTE_ORIGINS=https://sim.example.com` in the environment file. Keep any
native-worker token in that file, readable only by the service administrator.
Use `curl http://127.0.0.1:8787/healthz` for health and aggregate connection/job
counts, the number of active bundle pools, and the advertised thread total across
all pools. No simulation specs, bearer tokens,
or participant addresses are logged.
Run a **single coordinator process**; multiple independent replicas would have
separate participant pools. Scaling across processes requires shared state.

## Scheduling and failure behavior

Each job has one fixed seed and contiguous chunks of at most 2,000 iterations.
Every chunk has a deterministic global offset, so changing workers never changes
its random stream. The requester starts its local workers before any network
reply. It computes from the beginning; helpers work from the end. This reduces
collisions. Owners claim each next local chunk over the socket and skip remote
leases until no other work remains, then steal them immediately. A claim revokes
the remote lease. Only the first accepted completion of an index is merged, and
reports from a canceled or already completed range cannot add iterations twice.
Final timestamps come from the requesting browser's clock. Global offsets fix RNG
assignment, but the native engine retains some proc timestamps between fights.
Changing batch or worker partitioning can therefore change combat history as
described in [the native guide](../wasm/README.md). Floating point sums can also
differ in the last few bits because batching changes addition order.

Leases expire after 15 seconds and get fresh random identities when reassigned.
Donors terminate workers at that deadline. A disconnect removes the owner's jobs
or requeues the donor's work. Ping/pong detects dead connections, and outbound
queue limits disconnect slow receivers. The client reconnects with backoff and
resubmits its job while excluding completed/local chunks. Turning the toggle off
terminates donations and detaches remote work; current local workers finish the
remaining ranges. Changing the sharing preference to off also revokes sharing in
other open tabs through the storage event; turning it back on stays an explicit
action in each tab.

Foreground UI batches stay busy between baseline/stat/row simulations, so idle
donation work does not compete with the rest of the same operation. Chunks already
computed remotely remain in the report if the user disables sharing mid-run.
Configurations outside the sharing limits (for example fights longer than ten
minutes or over 8,192 chunks) use the established local path.

The coordinator caps connections (512), jobs (512 total, 64 per connection),
chunk count (8,192 per job), incoming messages (1 MiB), message rate, queued bytes,
and job lifetime (30 minutes). It schedules pending jobs in round-robin order.
These are initial guardrails, not capacity measurements. Load-test the expected
participant count and full-report bandwidth before raising them. Chunk size and
network latency determine whether a particular short simulation becomes faster;
network acceleration is not guaranteed. Frozen/discarded tabs cannot be forced
to contribute; leases and local stealing handle their disappearance.

## Trust and public participation

Only fixed WASM code executes. Work contains JSON simulation data, never a script
URL or executable code. Specs and reports are bounded and validated, seed/count
and lease ownership are checked, and report labels must match the owner's spec.
Browser workers provide isolation and can be terminated even during native code.
Sharing is on by default, so the panel's always-visible text explains CPU, battery,
data, background work, and sharing the simulation setup with other participants
before any contribution happens, and the toggle turns it off in one click.
Profiles/account information are not part of the execution spec.

**Public helpers are untrusted.** Structural validation and build matching do not
prove that a helper ran the simulation. A malicious client can forge plausible
numbers. This implementation does not yet duplicate work, audit samples, establish
reputation, or provide cryptographic result verification. Before relying on a
public pool for authoritative results, add trusted recomputation/auditing or
restrict contributions to an authenticated pool. Origin checks stop unrelated
websites from connecting through ordinary browsers; native clients can spoof
origins. The opt-in protocol enforces reciprocity for the shipped client, not
proof of donated CPU or protection from clients using multiple identities. Add
proxy rate limits and account/authentication controls if abuse occurs.

## Native C++ pool protocol (application deferred)

The native worker application is intentionally not included. It will connect
using standard WebSocket JSON and the existing C++ execution-spec API. Connect
to `wss://sim.example.com/compute` with
`Authorization: Bearer <COMPUTE_WORKER_TOKEN>` and no Origin header, then send:

```json
{"type":"hello","protocol":2,"buildId":"<matching bundle buildId>","share":true,"slots":8,"busy":false}
```

Include the same `buildId` on every later message. Native workers can explicitly
join an older bundle's pool; they should not adopt the current web manifest's
hash unless their engine/data compatibility matches it.
The server replies `ready` and sends up to `slots` concurrent `work` messages.
This is a standing pull; no polling loop is necessary. Use a matching engine
revision and verify deterministic WASM/native parity before assigning the build
identity to a native binary. Native floating point/compiler behavior must preserve
the same iteration streams; claiming a matching identity alone is insufficient.

All messages below also carry the connection's `buildId`.

| Message | Direction | Fields and behavior |
| --- | --- | --- |
| `hello` | client → server | Protocol/build identity, `share: true`, integer `slots` 1–64, `busy` |
| `ready` | server → client | `protocol`, `buildId`, `leaseMs`, `networkThreads` |
| `submit` | owner → server | `job`, `claimed` chunk indices, `cancelled` lease IDs; atomic push transition |
| `submitted` | server → owner | `jobId`; acknowledgement, not a prerequisite to local work |
| `work` | server → helper | `leaseId`, `job`, zero-based `index`, `leaseMs` |
| `leased` | server → owner | `jobId`, `index`, `leaseId` |
| `claim` | owner → server | `jobId`, `index`; withdraw/revoke this chunk for local execution |
| `result` | helper → server | `leaseId`, native batch `report` |
| `result` | server → owner | `jobId`, `index`, validated `report` |
| `abandon` | helper → server | `cancelled` lease IDs, at most 64; requeue immediately |
| `cancel` | server → helper | `leaseId`; terminate that task and discard its report |
| `released` | server → owner | `jobId`, `index`, `leaseId` |
| `finish` | owner → server | `jobId`, `busy`; remove job, cancel helpers, optionally return to pull |
| `mode` | client → server | `busy`; can pull only after all owned jobs finish. Optional `slots` 1–64 re-advertises capacity without reconnecting |
| `unavailable` | server → owner | `jobId`; job lifetime expired, complete locally |

`networkThreads` is the total `slots` advertised by every **other** participant in
**this connection's pool**; the client being greeted is excluded, because the panel
already shows its own contribution on its own row. The first participant in a pool
therefore sees `0`, which is a real count rather than a missing one. It counts
advertised capacity, not the momentary pull budget, so a participant pushing its own
simulation still contributes its full count to what its peers see. Pools are per bundle
hash, so the number describes the compute that can actually accept this connection's
work rather than every connection on the coordinator. The server keeps it accurate as
participants join and leave, but only reports it in `ready`; a client shows the value
from its last handshake and refreshes it on reconnect. Re-advertising capacity through
`mode` leaves the figure alone, since a client's own threads were never part of it.
(`/healthz` reports `threads` across whole pools, so that total *does* include every
participant.) Treat it as advisory: it is a display figure with no effect
on scheduling, and a client that never receives one simply leaves the count unknown.

`job` is `{id, spec, seed, iterations, offset, chunkSize, fullReport}`. `spec` is
the resolved output of `Player.serializeSimulationSpec()`, documented in
[`wasm/README.md`](../wasm/README.md). For chunk index `i`, call:

```text
createEngine(JSON(spec), seed)
runBatch(handle,
         min(chunkSize, iterations - i * chunkSize),
         offset + i * chunkSize,
         fullReport)
```

Reuse a handle for chunks of the same job. Destroy it when changing jobs. Return
the complete batch-only JSON, including `engineVersion` and `seed`; never return
cumulative counters from previous chunks. Respect cancellation, lease deadlines,
the 1 MiB payload limit, and WebSocket ping/pong. New connections have new leases;
do not resubmit results from an old connection.

## Verification

```sh
npm ci --prefix server
npm run test:compute
npm test
npm run test:wasm
```

The compute suite covers concurrent old/new pools, identical job IDs across pools,
per-message hash enforcement, complete preloading, once-per-load client hashing,
worker recreation after server asset removal, manifest/asset tampering, failed
preload cleanup, scheduler races, opt-out, disconnect/reconnect, ownership,
expiry, invalid inputs, exact iteration coverage, full player-report merging,
the default-on sharing preference and its stored refusal, pool thread accounting
across joins and departures, the thread rows the panel renders, and
two browser-protocol clients using actual deployed WASM workers over a real local
WebSocket coordinator. It requires built `wasm/dist` and `dist` assets. Background
throttling and real internet speedups still require field testing.

Validation of this shared-compute port passed all 178 Node tests across the
WASM, reference, worker, and compute suites, plus 20 source regressions (198 tests
total). Another 20 regression checks passed against minified deployment assets.
Actual browser checks passed local DPS and stat weights for both Classic and SoD,
sharing in both directions with four active donor workers, immediate foreground
role switching, cross-tab opt-out, and Classic gear ranking with every row
completed and no errors or waiting rows.

With the active bundle directory temporarily unavailable and its WASM URL
returning HTTP 404, both local modes and both shared stat-weight operations still
completed from retained assets; the SoD tab donated three workers during that
check. The directory was restored and its WASM URL returned HTTP 200. These browser
checks produced no console errors. After stopping the coordinator and static
server, both already-open pages also completed fresh DPS runs with sharing enabled
and displayed `Connecting · simulations run locally`, confirming browser fallback
when the coordinator is unavailable.

For a local browser preview, run `npm run compute:dev` and open
`http://127.0.0.1:8787/index.html` (SoD) or
`http://127.0.0.1:8787/classic.html` (Classic) in two tabs. Enable sharing in both,
then start a simulation in one. This development server serves only site assets, binds to
loopback, and disables caching. Use the HTTPS proxy setup above for deployment.
