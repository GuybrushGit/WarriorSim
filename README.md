# WarriorSim
A webapp to simulate how 1.12/Classic and Season of Discovery DPS Warrior performs with different gear, buffs, rotations, and talents.

Latest commit is up live here:
https://guybrushgit.github.io/WarriorSim/

## Self-hosting and Contributing

[See here.](CONTRIBUTING.md)

Simulations run in WebAssembly, with a separate native engine in each browser worker.
Classic (`classic.html`) and Season of Discovery (`index.html`) keep their existing
JavaScript character setup and catalogs. See [the native engine guide](wasm/README.md)
for the resolved-spec interface, optimizations, and parity validation.

**Share Compute** contributes idle browser workers and receives help with your
simulations. It is **on by default**, and turning it off is remembered in that
browser. The panel lists your local threads (always used for your own runs), the
pool's advertised threads, and the threads you share. Starting a simulation
immediately gives your own work priority; disabling sharing keeps execution
local and dims the two sharing rows. Both Classic and SoD use the same optional
[compute coordinator](server/README.md), with separate pools for each bundle hash.
Each tab preloads and verifies its complete simulation bundle at startup, so later
simulations keep working after deployment assets change. Public helper results
are structurally validated but are not independently audited.
