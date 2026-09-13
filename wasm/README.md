# Native Classic and Season of Discovery simulation engine

JavaScript constructs the player from this repository's unchanged Classic/SoD catalogs and serializes the resolved configuration once per worker. C++ owns the entire combat loop, RNG, attacks, spells, auras, procs, and report accumulation; there are no per-event JavaScript callbacks.

## Build

Use `./wasm/build.ps1` for Release, `./wasm/build.ps1 -Profiling` for the separate profiling artifact, or `-Configuration Debug`. The script finds Emscripten through EMSDK or the sibling `../emsdk` installation. Generated artifacts live under `wasm/dist`.

## Interface

The ES-module default factory exposes `createEngine(JSON.stringify(spec), seed)`, `runBatch(handle, count, globalIterationOffset, fullReport)`, and `destroyEngine(handle)`. Specification version 1 contains resolved scalar properties, spell/aura constructor kinds and links, weapon/proc definitions, and simulation parameters. Unknown kinds, unsupported game modes and dangling links fail closed. Seeds and iteration ranges are unsigned 32-bit values.

Each iteration uses Mulberry32 seeded by `seed + imul(globalIteration, 0x9e3779b9)`. Report counters reset at batch boundaries; combat reset follows the JavaScript implementation. Existing proc timestamps persist between fights, including their initially absent state, so RNG stream partitioning does not imply that every synthetic cross-worker partition has identical combat history.

## Shared execution

The optional [compute coordinator](../server/README.md) distributes resolved
Classic or SoD execution specs to opted-in helpers running the same bundle hash.
A shared worker needs only its fixed worker code, WASM loader, and binary; it
receives the complete resolved spec with the job. It never downloads executable
code supplied by another participant. Each tab preloads and retains every manifest
asset, including both game catalogs, before startup. Its later local and donated
workers use those retained assets even if the original bundle directory is removed.

Shared chunks use the existing engine interface with a fixed seed and disjoint
global iteration ranges. Report counters are batch-only. The retained proc
timestamp behavior described above still applies: changing batch or worker
partitioning can change combat history, and aggregation order can also change
floating point sums. Shared execution does not alter the native combat mechanics.
The protocol is ready for a future native worker application, which must be built
and checked against the advertised bundle's engine behavior before joining its pool.

## Replay log

The source optimization sequence was replayed in order, with this repository's JavaScript combat behavior as authority. Every stage compiled and passed the native/API parity tests available at that stage. All measurements below were taken in this destination.

1. **3622744 — initial native port.** Adapted Execute's 1 ms timer, Slam cast duration/GCD/queued-strike cancellation and after-swing threshold, Shield Slam AP coefficient, original 3-second Deep Wounds ticks, Blood Fury GCD/one-use behavior, one-use potions and trinkets, Classic crit suppression, SoD dodge-timeworn subtraction order, aura multiplier order, Heroic Strike-only damage bonus, recursive phantom strikes and unmitigated physical proc damage. Preserved destination proc timestamp state across fights and Hamstring's inherited cooldown/rage eligibility. Spell costs, talents, ranks, aura stats and durations are resolved by the unchanged destination constructors.
2. **56d8c62 — compile-time property and action IDs.** Replayed explicit ID literals and stance-to-action lookup helpers. Preserved destination-specific dense properties (afterswing, swingreset, dodgetimeworn), combat formulas and proc timestamp semantics.
3. **24748e5 — configured action and aura lists.** Built per-player ordered lists once after decoding. Preserved destination selection, stepping, expiration and reporting order. Proc-linked auras remain in the same positions.
4. **3ed144c — guarded integer remainder.** Replayed the uint32 fast path with floating remainder fallback for fractional, negative, nonfinite and out-of-range values. Applied the helper to Classic Execute's 1 ms timer too. Fractional clocks remain covered by parity tests.
5. **620e1eb — impossible ability checks.** Replayed kind-guarded pruning of unreachable Unstoppable Might, Stance Switch and unscheduled Bloodrage selections. Supported kind aliases retain their ordinary checks.
6. **c63380e — proc plans and scalar caches.** Replayed ordered per-weapon proc plans and scalar caches, including initialization for synthesized magic/Spicy procs. Destination attack-proc slots always use damage/activation handling even if an extra field is present; weapon and trinket extra-proc branches retain their separate semantics and RNG order. Preserved recursive phantom strikes and zero-chance trigger rolls.

Expanded tests found a trinket extra-proc guard adaptation error and the Hamstring eligibility difference. Both were corrected and backported to earlier saved stage sources. The initial baseline binary was rebuilt from its corrected snapshot sources with the same Release flags before comparison; live sources were never swapped.

## Validation

Final validation passed 158 tests: 69 JavaScript/worker tests, 69 native/API tests, and 20 existing simulation regressions. The 20 regressions also passed against minified deployment assets. Actual deployed-worker bridges with real WASM passed for both Classic and SoD. No browser provider was available for an interactive UI test.

Coverage includes full reports, seed boundaries, persistent batches, worker partitions, fractional clocks, after-swing Slam, long on-use fights, inherited Hamstring eligibility, recursive physical procs, proc RNG order, supported action aliases, Bloodrage schedules, stance changes, SoD runes and dynamically installed Spicy procs. An independent initial-versus-final comparison checked 33 configurations at three seeds: all 99 full-report comparisons, representing 672 fights per engine, were strictly identical after excluding wall-clock timestamps only.

## Destination measurements

Measurements used Release builds on the same machine, with setup excluded and alternating engine order. Values are median elapsed milliseconds, not guarantees for other machines or workloads. The JavaScript comparison used 5,000 warmup fights, 2,000 measured fights and five alternating rounds; each round passed aggregate parity checks. Long fights lasted 90–120 seconds.

| Scenario | JavaScript ms | Final WASM ms | Speedup |
| --- | ---: | ---: | ---: |
| Classic dual wield | 77.187 | 24.877 | 3.103× |
| Classic adjacent Cleave | 75.518 | 21.923 | 3.445× |
| Classic two-hand Slam | 48.389 | 11.520 | 4.200× |
| SoD default two-hand | 99.759 | 32.427 | 3.076× |
| SoD two-hand runes | 104.463 | 35.018 | 2.983× |
| SoD long fight | 497.950 | 164.340 | 3.030× |
| Classic long fight | 280.698 | 123.341 | 2.276× |

The optimization-only comparison used 10,000 warmup fights, 10,000 measured fights and seven alternating rounds. Its baseline is the adapted initial native port, including the same correctness fixes as the final engine.

| Scenario | Initial WASM ms | Optimized WASM ms | Speedup | Time reduction |
| --- | ---: | ---: | ---: | ---: |
| Classic short | 278.224 | 124.845 | 2.229× | 55.13% |
| Classic long | 1448.233 | 618.345 | 2.342× | 57.30% |
| SoD short | 314.486 | 169.569 | 1.855× | 46.08% |
| SoD long | 1717.538 | 830.137 | 2.069× | 51.67% |

Raw local measurement artifacts are `wasm/dist/classic-sod-benchmark.jsonl` and `wasm/dist/optimization-benchmark.jsonl`. Corrected source snapshots and stage binaries are under `wasm/dist/stages`; these generated artifacts are ignored by Git.

## Final profile

The separate profiling build was sampled with:

```text
node test/wasm/profile-native.js all 500000 100000 wasm/dist/profiles/classic-sod-final
```

The table reports sampled self-time percentages. `runOne` includes inlined work, so these percentages should not be interpreted as isolated source-level function costs. Release measurements above remain the throughput results.

| Function | Classic short | Classic long | SoD short | SoD long |
| --- | ---: | ---: | ---: | ---: |
| runOne | 53.83% | 54.58% | 36.94% | 37.32% |
| spellCanUse | 5.97% | 6.51% | 5.80% | 6.16% |
| attackMh | 5.47% | 6.12% | 4.81% | 5.32% |
| procAttack | 3.93% | 3.79% | 3.59% | 4.32% |
| auraStep | 4.57% | 3.62% | 7.01% | 6.89% |
| cast | 2.90% | 3.07% | 5.55% | 6.05% |

SoD string-valued property map lookup accounted for 8.12% and 9.13% of self time in the short and long profiles. The summary alone does not identify a specific property key. Raw profile summaries are in `wasm/dist/classic-sod-profile.jsonl`, with CPU profiles under `wasm/dist/profiles/classic-sod-final`. No further optimization changes were made after this profile.
