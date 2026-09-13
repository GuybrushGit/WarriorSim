# Development and self-hosting

The browser runs each simulation in WebAssembly. JavaScript resolves the selected
Classic or Season of Discovery character once per worker; the native engine runs
combat batches without JavaScript event callbacks or a JavaScript fallback.

## Build the browser assets

Install a current Node.js runtime and the Emscripten SDK. Activate Emscripten in your
shell, set `EMSDK` to its root, or put the SDK at `../emsdk` beside this repository.
On Windows, run:

```powershell
npm run dist
```

This builds the native Release module and minifies all application JavaScript with
Emscripten's bundled Terser. Class and function names are preserved because action
serialization uses constructor names. Commit the resulting `dist/js` and
`dist/wasm` assets together after validating them. The checked-in CSS remains usable.
Use `npm run wasm` to rebuild only the native module, or
`powershell -NoProfile -File scripts/build-dist.ps1 -SkipWasmBuild` to reuse a native
build that already matches the current source. Never publish mismatched JS/WASM assets.

Serve the repository through HTTP rather than opening an HTML file directly. For
example, run `python -m http.server 8000`, then open `http://localhost:8000/classic.html`
for Classic or `http://localhost:8000/index.html` for Season of Discovery. The server
must serve `.wasm` as `application/wasm`; module and worker files must be accessible
from the same origin.

## Validate changes

```powershell
npm test
npm run test:wasm
npm run benchmark
npm run test:regressions -- --dist
```

`npm test` runs the existing simulation regression suite plus JavaScript reference
and worker contract tests. Native parity/API tests and benchmarks require a fresh
`npm run wasm` build. See [test/README.md](test/README.md),
[test/wasm/README.md](test/wasm/README.md), and [wasm/README.md](wasm/README.md).
Seeded runs assign one seed and disjoint global iteration ranges to workers.
This preserves RNG assignment when the worker count changes; legacy proc timestamps
can still couple combat history across fights. See the native engine guide for
these retained reset semantics and the scope of partition parity checks.

## Optional CSS and legacy development server

The existing Gulp workflow requires the legacy `gulp-sass`/Node Sass toolchain.
Install the project dependencies with a compatible Node version if changing SCSS,
then use `npm run build:css` (CSS only), `npm run dist:full` (CSS plus JS/WASM), or
`npm run dev` (Gulp development server). Build the WASM module before starting the
legacy development server; its JavaScript watcher does not compile native changes.
