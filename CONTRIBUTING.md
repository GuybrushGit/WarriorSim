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

On Linux or macOS, run the shell equivalent:

```sh
./build-dist.sh
```

`build-dist.sh`/`build-dist.bat` are thin wrappers over `scripts/build-dist.sh` and
`scripts/build-dist.ps1`, which mirror each other. Keep the two in sync: the compiler
and Terser flags are part of the bundle identity and of the engine's numerical
behavior. The same Emscripten SDK produces byte-identical minified JavaScript and
Emscripten glue on both platforms; the `.wasm` differs only in the path separators
of source paths embedded in libc++abi assertion strings, which leaves the code
section identical but does change the `buildId`.

This builds the native Release module and minifies all application JavaScript with
Emscripten's bundled Terser. Class and function names are preserved because action
serialization uses constructor names. It also generates `dist/compute-build.json`
and a `dist/bundle/` directory containing the Classic and SoD application assets.
Each build replaces that directory whole, so old releases are not kept alongside it.
Keep the resulting `dist/js`, `dist/wasm`, manifest, and bundle directory together
after validating them. The checked-in CSS remains usable.
Use `npm run wasm` (or `./wasm/build.sh`) to rebuild only the native module, or
`powershell -NoProfile -File scripts/build-dist.ps1 -SkipWasmBuild` /
`./build-dist.sh --skip-wasm-build` to reuse a native build that already matches the
current source. Never publish mismatched JS/WASM assets. `dist/wasm/package.json`
marks the deployed Emscripten glue as an ES module so Node can `import()` it; without
it the deployed-artifact tests cannot load `dist/wasm/warriorsim.js`.

Serve the repository through HTTP rather than opening an HTML file directly. For
example, run `python -m http.server 8000`, then open `http://localhost:8000/classic.html`
for Classic or `http://localhost:8000/index.html` for Season of Discovery. The server
must serve `.wasm` as `application/wasm`; module and worker files must be accessible
from the same origin. Web Crypto requires HTTPS or a localhost origin. Both pages
preload and verify the complete bundle before initializing, and retain all assets
for future workers. Deploy the complete new snapshot before replacing the current
manifest; keep a grace period for tabs still preloading the previous snapshot.

## Optional shared compute

Sharing requires a WebSocket coordinator in addition to the static site. Install
its independent dependencies and start a loopback preview:

```powershell
npm ci --prefix server
npm run compute:dev
```

Open `http://127.0.0.1:8787/classic.html` for Classic or
`http://127.0.0.1:8787/index.html` for SoD. Enable **Share Compute** in two tabs to
exercise donations and foreground priority. Without a coordinator, simulations
continue locally. The toggle must be enabled to receive or donate shared work.

For AWS or another serving host, run one coordinator behind the existing HTTPS
proxy. See [server/README.md](server/README.md) for origin configuration, deployment,
bundle retention, lease recovery, native worker protocol, and public-result trust
limits. The native worker application is a later project.

## Validate changes

```powershell
npm test
npm run test:wasm
npm run test:compute
npm run benchmark
npm run test:regressions -- --dist
```

`npm test` runs the existing simulation regression suite plus JavaScript reference
and worker contract tests. The compute suite also requires the coordinator
dependencies and freshly built deployment assets. Native parity/API tests and benchmarks require a fresh
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
