'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {createConfiguredPlayer, createReferenceEngine, loadFixtures} = require('./reference-engine');
const {loadNativeModule} = require('./native-engine');

const fixture = loadFixtures().find(value => value.name === 'classic-dw-fury');
let wasmModule;

function executionSpec() {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    return player.serializeSimulationSpec(fixture.sim);
}

function errorText(callback) {
    try {
        callback();
        assert.fail('expected native API call to throw');
    } catch (error) {
        const flatten = value => Array.isArray(value)
            ? value.map(flatten).join(': ')
            : value && typeof value === 'object' && value.what
                ? flatten(value.what)
                : String(value);
        return flatten(error && error.message || error);
    }
}

test.before(async () => {
    wasmModule = await loadNativeModule();
});

test('native API rejects invalid duration ranges before allocating an engine', () => {
    for (const sim of [
        {timesecsmin: 22, timesecsmax: 18},
        {timesecsmin: -1, timesecsmax: 18},
    ]) {
        const spec = executionSpec();
        Object.assign(spec.sim, sim);
        assert.match(errorText(() => wasmModule.createEngine(JSON.stringify(spec), 1)),
            /invalid simulation duration range/);
    }
});

test('native API rejects unknown kinds and dangling action references', () => {
    const unknownKind = executionSpec();
    unknownKind.player.auras[0].kind = 'UnknownAuraForParityTest';
    assert.match(errorText(() => wasmModule.createEngine(JSON.stringify(unknownKind), 1)),
        /unsupported aura kind/);

    const dangling = executionSpec();
    dangling.player.links.normalSpells = [{type: 'spell', key: 'missing-action'}];
    assert.match(errorText(() => wasmModule.createEngine(JSON.stringify(dangling), 1)),
        /dangling normal action/);
});

test('native API validates uint32 arguments and iteration range before execution', () => {
    const spec = executionSpec();
    assert.match(errorText(() => wasmModule.createEngine(JSON.stringify(spec), -1)),
        /invalid unsigned 32-bit integer: seed/);
    const handle = wasmModule.createEngine(JSON.stringify(spec), 1);
    try {
        for (const count of [-1, 1.5, Number.NaN, 0x100000000]) {
            assert.match(errorText(() => wasmModule.runBatch(handle, count, 0, false)),
                /invalid unsigned 32-bit integer: count/);
        }
        assert.match(errorText(() => wasmModule.runBatch(handle, 2, 0xFFFFFFFF, false)),
            /iteration range exceeds unsigned 32-bit space/);
    } finally {
        wasmModule.destroyEngine(handle);
    }
});

test('destroyed handles reject use and repeated destruction', () => {
    const spec = executionSpec();
    const handle = wasmModule.createEngine(JSON.stringify(spec), 1);
    wasmModule.destroyEngine(handle);
    assert.match(errorText(() => wasmModule.runBatch(handle, 1, 0, false)),
        /invalid or destroyed engine handle/);
    assert.match(errorText(() => wasmModule.destroyEngine(handle)),
        /invalid or destroyed engine handle/);
});
