# Classic and Season of Discovery WASM validation

The reference engine loads this repository's `session.js` or `session_sod.js` and the matching gear catalog. It executes the production JavaScript combat engine unchanged. No native-generated reference results are used.

- `npm test`: existing combat regressions, deterministic JavaScript full-report goldens, serializer checks, and source/minified worker control tests.
- `npm run test:wasm`: full native counter parity at fixed/zero/max seeds, every fixture's uneven persistent and fresh partitions, ABI validation, optimized edge cases, and the deployed worker with the actual distribution WASM module.
- `node test/wasm/update-goldens.js`: deliberately regenerate sparse full-report goldens from JavaScript only. Review combat changes before accepting updated output.
- `npm run benchmark -- 1000 250 5`: warmed Classic and SoD direct-JavaScript/native comparison (measured iterations, warmup, rounds).
- `node test/wasm/profile-native.js all 50000 10000`: requires the profiling WASM build; profiles both rulesets at short and 90–120 second durations.

Fixtures cover Classic dual wield, Cleave, after-swing Slam, and SoD default two-hand, explicit rune variants, dual wield, Gladiator/shield, and a level-40 Ravager character with lower-level talents. Extra fixtures cover recursive physical procs, Heroic-only set bonus, target level suppression, real Timeworn/signets, and scheduled trinket expiration over 190-second fights. Full comparisons include damage, duration, DPS moments/extrema, sparse histogram, all action outcomes, aura uptime, weapon proc damage, and Execute rage. Numeric sums allow floating addition rounding (relative 1e-12); event counts and histogram bins are exact.

Worker VM tests exercise actual source/dist scripts and catalogs. The native worker bridge also executes the real deployed glue and WASM ABI; this does not claim an interactive browser UI was tested.

Benchmark output belongs to the current checkout/build and local machine. Compare identical fixture definitions, iteration counts, warmups, and rounds. It does not reuse source-project speedup claims.
