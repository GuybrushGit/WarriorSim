'use strict';

const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {
    createConfiguredPlayer,
    createReferenceEngine,
} = require('./reference-engine');

const ROOT = path.resolve(__dirname, '..', '..');

async function loadNativeModule() {
    const gluePath = path.join(ROOT, 'wasm', 'dist', 'warriorsim.js');
    const factory = (await import(pathToFileURL(gluePath).href)).default;
    return factory();
}

function createNativeHandleFromSpec(module, specJson, seed) {
    return module.createEngine(specJson, seed >>> 0);
}

function createNativeHandle(module, fixture, simOverrides = {}) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    const sim = {...fixture.sim, ...simOverrides};
    const spec = player.serializeSimulationSpec(sim);
    const handle = createNativeHandleFromSpec(module, JSON.stringify(spec), sim.seed);
    return {handle, sim, spec};
}

function runNative(module, fixture, simOverrides = {}, fullReport = true) {
    const {handle, sim} = createNativeHandle(module, fixture, simOverrides);
    try {
        return JSON.parse(module.runBatch(
            handle,
            sim.iterations,
            sim.iterationOffset || 0,
            fullReport,
        ));
    } finally {
        module.destroyEngine(handle);
    }
}

module.exports = {
    createNativeHandle,
    createNativeHandleFromSpec,
    loadNativeModule,
    runNative,
};
