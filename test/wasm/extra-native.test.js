'use strict';

const test = require('node:test');
const {extraFixtures} = require('./extra-fixtures');
const {assertNativeReports} = require('./report-assertions');
const {runReference, mergeReports} = require('./reference-engine');
const {loadNativeModule, runNative, createNativeHandle} = require('./native-engine');
let wasmModule;

test.before(async () => { wasmModule = await loadNativeModule(); });

for (const fixture of extraFixtures()) {
    test(`${fixture.name}: optimized native complete parity and persistent batches`, () => {
        const expected = runReference(fixture);
        assertNativeReports(runNative(wasmModule, fixture), expected, fixture.name);
        const {handle} = createNativeHandle(wasmModule, fixture);
        const batches = [];
        let offset = 0;
        const partitions = fixture.sim.iterations === 3 ? [1, 2] : [1, 4, fixture.sim.iterations - 5];
        try {
            for (const count of partitions) {
                batches.push(JSON.parse(wasmModule.runBatch(handle, count, offset, true)));
                offset += count;
            }
        } finally {
            wasmModule.destroyEngine(handle);
        }
        assertNativeReports(mergeReports(batches), expected, fixture.name + ' persistent');
    });
}

for (const mode of ['classic', 'sod']) test(`${mode}: deployed worker and actual WASM ABI preserve full reports across batches`, async () => {
    const path = require('node:path');
    const {pathToFileURL} = require('node:url');
    const assert = require('node:assert/strict');
    const {createWorkerHarness} = require('./worker-harness');
    const {createReferenceEngine, createState, loadFixtures} = require('./reference-engine');
    const factory = (await import(pathToFileURL(path.resolve(__dirname, '../../dist/wasm/warriorsim.js')).href)).default;
    const actualModule = await factory();
    const fixture = loadFixtures().find(value => value.mode === mode);
    const engine = createReferenceEngine(mode);
    const sim = {...fixture.sim, iterations: 7, iterationOffset: 13};
    const worker = createWorkerHarness(actualModule);
    await worker.run({
        player: [null, null, null, {...fixture.player, mode}],
        globals: {...createState(engine, fixture), sod: mode === 'sod'},
        sim, fullReport: true, batchSize: 3,
    });
    assert.equal(worker.messages.length, 3, 'two progress messages and one final report');
    assert.equal(worker.messages[0][1], 3);
    assert.equal(worker.messages[1][1], 6);
    const actual = worker.messages[2][1];
    assertNativeReports(actual, runReference(fixture, {sim}), `${mode} actual deployed worker`);
});
