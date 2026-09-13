'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {WebSocket} = require('../../server/node_modules/ws');
const {createServer} = require('../../server');
const {BUILD, P, harness, job} = require('./helpers');
const {createConfiguredPlayer, createReferenceEngine, loadFixtures} = require('../wasm/reference-engine');
const {loadNativeModule, runNative} = require('../wasm/native-engine');
const {deployedWorkers, request} = require('./worker-harness');

async function serving(t, options = {}) {
    const app = createServer({origins: ['https://sim.test'], ...options});
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    t.after(() => app.close());
    return {...app, url: `ws://127.0.0.1:${app.server.address().port}/compute`};
}
async function until(check, timeout = 10000) {
    const started = Date.now();
    while (!check()) {
        if (Date.now() - started > timeout) throw new Error('Timed out waiting for compute state');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function comparePlayer(actual, expected, key = '') {
    if (typeof expected === 'number' && ['totaldmg', 'totalprocdmg', 'uptime'].includes(key)) {
        // Per-event floating point accumulation changes grouping at batch boundaries.
        assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-9), key);
    } else if (expected && typeof expected === 'object') {
        assert.deepEqual(Object.keys(actual), Object.keys(expected));
        for (const name of Object.keys(expected)) comparePlayer(actual[name], expected[name], name);
    } else assert.equal(actual, expected, key);
}

test('WebSocket endpoint rejects foreign origins and accepts an authenticated native worker', async t => {
    const app = await serving(t, {workerToken: 'test-pool-token'});
    for (const options of [{origin: 'https://wrong.test'}, {}]) {
        const ws = new WebSocket(app.url, options);
        const error = await new Promise(resolve => ws.once('error', resolve));
        assert.match(error.message, /403/);
    }
    const native = new WebSocket(app.url, {headers: {Authorization: 'Bearer test-pool-token'}});
    await once(native, 'open');
    const reply = once(native, 'message');
    native.send(JSON.stringify({type: 'hello', protocol: P.version, buildId: BUILD, share: true, slots: 4}));
    assert.equal(JSON.parse((await reply)[0]).type, 'ready');
    native.close();
});

test('real WASM reports validate and mixed chunks preserve all aggregate/player counters', async () => {
    const module = await loadNativeModule();
    const {api} = harness();
    for (const fixture of loadFixtures()) {
        const player = createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture);
        const sim = {...fixture.sim, iterations: 321, iterationOffset: 17};
        const value = job(fixture.name, {spec: player.serializeSimulationSpec(sim),
            iterations: sim.iterations, offset: sim.iterationOffset, seed: sim.seed, fullReport: true});
        assert.ok(P.job(value), `${fixture.name}: spec`);
        const handle = module.createEngine(JSON.stringify(value.spec), value.seed);
        let merged;
        try {
            for (const index of [2, 0, 1]) {
                const range = P.range(value, index);
                const delta = JSON.parse(module.runBatch(handle, range.count, range.offset, true));
                assert.ok(P.report(delta, value, index), `${fixture.name}: report`);
                merged = api.mergeSimulationReports(merged, delta);
            }
        } finally { module.destroyEngine(handle); }
        const expected = runNative(module, fixture, sim);
        for (const key of ['iterations', 'totaldmg', 'totalduration', 'sumdps', 'sumdps2', 'mindps', 'maxdps']) {
            assert.ok(Math.abs(merged[key] - expected[key]) <= Math.max(1e-8, Math.abs(expected[key]) * 1e-12), `${fixture.name}: ${key}`);
        }
        comparePlayer(merged.player, expected.player);
        assert.deepEqual(Object.fromEntries(Object.entries(merged.spread)), expected.spread);
        const corrupt = structuredClone(expected);
        const first = Object.keys(corrupt.player.auras)[0];
        corrupt.player.auras[first].name = '<img src=x onerror=alert(1)>';
        assert.equal(P.report(corrupt, {...value, chunkSize: 321}, 0), false);
    }
});

for (const mode of ['classic', 'sod']) test(`${mode} browser clients execute deployed WASM workers through a live coordinator`, {timeout: 30000}, async t => {
    const app = await serving(t);
    const {Worker: BrowserWorker, url, manifest: {buildId}} = deployedWorkers();
    const fixture = loadFixtures().find(value => value.name === (mode === 'sod' ? 'sod-dw-runes' : 'classic-dw-fury'));
    class TestPlayer {
        constructor() { return createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture); }
    }
    class BrowserSocket extends WebSocket {
        constructor(url) { super(url, {origin: 'https://sim.test'}); }
    }
    const {api} = harness({Worker: BrowserWorker, WebSocket: BrowserSocket, Player: TestPlayer});
    const workerUrl = url('js/compute-worker.min.js');
    const owner = new api.SharedComputeClient({url: app.url, buildId, workerUrl, slots: 1});
    const helper = new api.SharedComputeClient({url: app.url, buildId, workerUrl, slots: 2});
    t.after(() => { for (const run of owner.runs.values()) run.cancel(); owner.setEnabled(false); helper.setEnabled(false); });
    owner.setEnabled(true);
    helper.setEnabled(true);
    await until(() => owner.ready && helper.ready);
    let remoteIterations = 0;
    const receive = owner.receive.bind(owner);
    owner.receive = message => { if (message.type === 'result') remoteIterations += message.report.iterations; receive(message); };
    const sim = {...fixture.sim, iterations: 8193, iterationOffset: 19};
    const accepted = [];
    const final = await new Promise((resolve, reject) => {
        const run = new api.SharedSimulation(owner, 1, resolve, () => {}, reject);
        const accept = run.accept.bind(run);
        run.accept = (index, value, local) => {
            accepted.push({...P.range(run.job, index), local});
            accept(index, value, local);
        };
        run.start({player: [], sim, fullReport: true});
    });
    assert.ok(remoteIterations > 0, 'helper must contribute real WASM iterations');
    assert.equal(final.iterations, sim.iterations);
    const expected = runNative(await loadNativeModule(), fixture, sim);
    for (const key of ['totaldmg', 'totalduration', 'sumdps', 'sumdps2']) {
        assert.ok(Math.abs(final[key] - expected[key]) <= Math.abs(expected[key]) * 1e-12, key);
    }
    comparePlayer(final.player, expected.player);
    assert.deepEqual(Object.fromEntries(Object.entries(final.spread)), expected.spread);
    let next = sim.iterationOffset;
    for (const range of accepted.sort((a, b) => a.offset - b.offset)) {
        assert.equal(range.offset, next, 'accepted ranges cover each requested iteration exactly once');
        next += range.count;
    }
    assert.equal(next, sim.iterationOffset + sim.iterations);
    assert.ok(accepted.some(range => range.local));
    assert.ok(accepted.some(range => !range.local));
    await until(() => app.coordinator.jobs.size === 0);
    assert.equal(owner.busy(), false);
    assert.equal(helper.busy(), false);
});

test('a donated worker refreshes its native engine when a reused job ID has a different seed or spec', {timeout: 15000}, async t => {
    const {Worker, url} = deployedWorkers();
    const worker = new Worker(url('js/compute-worker.min.js'));
    t.after(() => worker.terminate());
    const module = await loadNativeModule();
    const fixtures = loadFixtures();
    for (const [mode, seed] of [['classic', 42], ['classic', 43], ['sod', 43]]) {
        const fixture = fixtures.find(value => value.mode === mode);
        const sim = {...fixture.sim, seed, iterations: 17, iterationOffset: 11};
        const player = createConfiguredPlayer(createReferenceEngine(mode), fixture);
        const spec = player.serializeSimulationSpec(sim);
        const actual = await request(worker, {id: `lease-${mode}-${seed}`, jobId: 'reused-id', spec,
            seed, count: sim.iterations, offset: sim.iterationOffset, fullReport: true});
        const expected = runNative(module, fixture, sim);
        assert.equal(actual.seed, seed);
        for (const key of ['iterations', 'totaldmg', 'totalduration', 'sumdps', 'sumdps2', 'mindps', 'maxdps']) {
            assert.equal(actual[key], expected[key], `${mode}/${seed}: ${key}`);
        }
        comparePlayer(actual.player, expected.player);
    }
});
