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
