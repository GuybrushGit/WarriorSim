'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {createHash, webcrypto} = require('node:crypto');
const {buildBundle} = require('../../scripts/compute-build');
const {ROOT} = require('./helpers');
const {createWorkerClass, request} = require('./worker-harness');
const {createState, createConfiguredPlayer, createReferenceEngine, loadFixtures} = require('../wasm/reference-engine');
const {loadNativeModule, runNative} = require('../wasm/native-engine');

function workspace(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'warriorsim-bundle-'));
    t.after(() => {
        const resolved = path.resolve(directory);
        if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('warriorsim-bundle-')) {
            throw new Error('Unexpected test cleanup path');
        }
        fs.rmSync(resolved, {recursive: true, force: true});
    });
    fs.mkdirSync(path.join(directory, 'dist'));
    for (const name of ['js', 'wasm']) fs.cpSync(path.join(ROOT, 'dist', name), path.join(directory, 'dist', name), {recursive: true});
    return directory;
}
function load(root, supplied, mode = 'sod', options = {}) {
    let hashes = 0, fetches = 0;
    const loaded = [], requested = [], blobs = new Map();
    class MemoryURL extends URL {
        static createObjectURL(blob) {
            const url = `blob:https://sim.test/${blobs.size}`;
            blobs.set(url, blob);
            return url;
        }
        static revokeObjectURL(url) { blobs.delete(url); }
    }
    const context = vm.createContext({URL: MemoryURL, Blob, TextEncoder, Uint8Array, mode,
        crypto: {subtle: {digest(...args) { hashes++; return webcrypto.subtle.digest(...args); }}},
        console: {error() {}},
        fetch: async (url, options) => {
            fetches++;
            requested.push(String(url));
            if (String(url) === 'https://sim.test/subpath/dist/compute-build.json') {
                assert.equal(options.cache, 'no-store');
                return {ok: true, json: async () => supplied || JSON.parse(fs.readFileSync(path.join(root, 'dist/compute-build.json')))};
            }
            const file = path.join(root, new URL(url).pathname.replace('/subpath/', ''));
            return {ok: fs.existsSync(file), arrayBuffer: async () => Uint8Array.from(fs.readFileSync(file)).buffer};
        },
        document: {
            currentScript: {src: 'https://sim.test/subpath/dist/js/bundle-loader.min.js'},
            createElement() { return {setAttribute() {}}; },
            body: {prepend() {}},
            head: {appendChild(script) {
                assert.ok(blobs.has(script.src), 'page scripts use retained bytes');
                loaded.push(script);
                queueMicrotask(() => options.scriptFailure ? script.onerror() : script.onload());
            }},
        },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/bundle-loader.js'), 'utf8'), context);
    return {context, loaded, requested, blobs, hashCount: () => hashes, fetchCount: () => fetches};
}

async function workerContext(tab, bundle, entry) {
    const sources = new Map(await Promise.all([...tab.blobs].map(async ([url, blob]) => [url, await blob.text()])));
    const imported = [];
    let context;
    context = vm.createContext({URL, console, setTimeout, clearTimeout, postMessage() {},
        location: {href: bundle.workerUrl(entry)},
        importScripts(...urls) {
            for (const url of urls) {
                assert.ok(sources.has(url), 'worker imports only retained assets');
                imported.push(url);
                vm.runInContext(sources.get(url), context, {filename: url});
            }
        }});
    context.self = context;
    vm.runInContext(sources.get(bundle.workerUrl(entry)), context);
    return {context, imported};
}

test('bundle identity covers code, WASM, content, and entrypoint order but excludes incidental metadata', t => {
    const root = workspace(t);
    const first = buildBundle(root);
    const files = first.files.map(file => file.path);
    for (const file of ['wasm/warriorsim.wasm', 'wasm/warriorsim.js', 'js/compute-worker.min.js',
        'js/compute-protocol.min.js', 'js/classes/player.min.js', 'js/classes/simulation.min.js',
        'js/data/gear.min.js', 'js/data/gear_sod.min.js', 'js/data/runes.min.js', 'js/data/buffs.min.js', 'js/data/spells.min.js',
        'js/data/talents.min.js', 'js/data/enchants.min.js', 'js/data/levelstats.min.js']) assert.ok(files.includes(file), file);
    fs.mkdirSync(path.join(root, 'dist/css'));
    fs.writeFileSync(path.join(root, 'dist/css/style.css'), 'body {color: red}');
    fs.utimesSync(path.join(root, 'dist/js/data/gear_sod.min.js'), new Date(), new Date());
    assert.equal(buildBundle(root).buildId, first.buildId);
    fs.appendFileSync(path.join(root, 'dist/js/data/gear_sod.min.js'), '\n// new content');
    const second = buildBundle(root);
    assert.notEqual(second.buildId, first.buildId);
    fs.appendFileSync(path.join(root, 'dist/wasm/warriorsim.wasm'), Buffer.from([0]));
    const third = buildBundle(root);
    assert.notEqual(third.buildId, second.buildId);
    assert.ok(fs.existsSync(path.join(root, 'dist/bundles', first.buildId, 'wasm/warriorsim.wasm')));
});

test('each tab preloads the whole bundle once and executes real local/shared WASM after server assets disappear', {timeout: 20000}, async t => {
    const root = workspace(t);
    const first = buildBundle(root);
    const oldTab = load(root);
    const oldBundle = await oldTab.context.simulatorReady;
    fs.appendFileSync(path.join(root, 'dist/js/data/spells.min.js'), '\n// changed spells');
    const second = buildBundle(root);
    const newTab = load(root, undefined, 'classic');
    const newBundle = await newTab.context.simulatorReady;
    assert.equal(oldBundle.buildId, first.buildId);
    assert.equal(newBundle.buildId, second.buildId);
    for (const [tab, bundle, manifest] of [[oldTab, oldBundle, first], [newTab, newBundle, second]]) {
        for (const file of manifest.files) {
            const blob = tab.blobs.get(bundle.url(file.path));
            assert.ok(blob, file.path);
            assert.equal(createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'), file.sha256);
        }
        assert.equal(tab.hashCount(), manifest.files.length + 1, 'one bundle digest and one verification per file');
        assert.equal(tab.fetchCount(), manifest.files.length + 1, 'one manifest and one request per asset');
        assert.equal(new Set(tab.requested).size, tab.fetchCount());
        assert.deepEqual(tab.loaded.map(script => script.src), Array.from(manifest.entrypoints[tab.context.mode], file => bundle.url(file)));
    }
    // Rename inside this test's temporary workspace to simulate deployment cleanup.
    const oldDirectory = path.join(root, 'dist/bundles', first.buildId);
    fs.renameSync(oldDirectory, oldDirectory + '.offline');
    for (const sod of [true, false]) {
        const {context} = await workerContext(oldTab, oldBundle, 'js/sim-worker.min.js');
        vm.runInContext(`importRules(${sod})`, context);
        assert.equal(vm.runInContext('WASM_MODULE_URL', context), oldBundle.url('wasm/warriorsim.js'));
        assert.equal(context.SIMULATOR_BUNDLE.url('wasm/warriorsim.wasm'), oldBundle.url('wasm/warriorsim.wasm'));
        assert.equal(typeof context.onmessage, 'function');
    }
    // Terminated workers can be recreated from the same retained bootstrap repeatedly.
    for (let i = 0; i < 2; i++) {
        const {context} = await workerContext(oldTab, oldBundle, 'js/compute-worker.min.js');
        assert.equal(vm.runInContext('computeModuleUrl', context), oldBundle.url('wasm/warriorsim.js'));
        assert.equal(typeof context.onmessage, 'function');
    }
    const retained = new Map(await Promise.all([...oldTab.blobs].map(async ([url, blob]) => [url, await blob.arrayBuffer()])));
    const Worker = createWorkerClass(retained);
    t.after(() => Promise.all(Worker.all.map(worker => worker.terminate())));
    const module = await loadNativeModule();
    for (const mode of ['classic', 'sod']) {
        const fixture = loadFixtures().find(value => value.name === (mode === 'sod' ? 'sod-dw-runes' : 'classic-dw-fury'));
        const engine = createReferenceEngine(mode);
        const sim = {...fixture.sim, iterations: 17, iterationOffset: 23};
        const player = createConfiguredPlayer(engine, fixture);
        const expected = runNative(module, fixture, sim);
        const localWorker = new Worker(oldBundle.workerUrl('js/sim-worker.min.js'));
        const local = await request(localWorker, {
            player: [null, null, null, {...fixture.player, mode}], sim,
            globals: {...createState(engine, fixture), sod: mode === 'sod'}, fullReport: true,
        }, true);
        await localWorker.terminate();
        const sharedWorker = new Worker(oldBundle.workerUrl('js/compute-worker.min.js'));
        const shared = await request(sharedWorker, {
            id: 'retained-lease', jobId: 'retained-job', spec: player.serializeSimulationSpec(sim),
            seed: sim.seed, offset: sim.iterationOffset, count: sim.iterations, fullReport: true,
        });
        await sharedWorker.terminate();
        for (const actual of [local, shared]) {
            for (const key of ['iterations', 'totaldmg', 'totalduration', 'sumdps', 'sumdps2', 'mindps', 'maxdps']) {
                assert.equal(actual[key], expected[key], `${mode}: ${key}`);
            }
            assert.deepEqual(actual.player, expected.player, `${mode}: complete player counters`);
            assert.deepEqual(Object.fromEntries(Object.entries(actual.spread)), expected.spread, `${mode}: spread`);
        }
    }
    assert.equal(oldTab.fetchCount(), first.files.length + 1, 'creating workers never refetches the bundle');
    assert.throws(() => { oldBundle.buildId = second.buildId; }, TypeError);
    assert.throws(() => oldBundle.url('../wasm/warriorsim.wasm'));
    assert.throws(() => oldBundle.workerUrl('js/ui.min.js'));
});

test('Classic and SoD preserve their original page script order and await the complete preload', t => {
    const {entrypoints} = buildBundle(workspace(t));
    const prefix = ['libs/jquery-3.4.1', 'libs/jquery.tablesorter', 'libs/jquery.tablesorter.widgets', 'libs/Chart',
        'classes/player', 'classes/simulation', 'compute-protocol', 'shared-compute', 'classes/spell', 'classes/weapon'];
    const expected = {
        classic: [...prefix, 'data/gear', 'data/enchants', 'data/levelstats', 'data/buffs', 'data/spells', 'data/talents',
            'data/session', 'globals', 'settings', 'profiles', 'stats', 'ui'],
        sod: [...prefix, 'data/gear_sod', 'data/runes', 'data/levelstats', 'data/buffs', 'data/enchants', 'data/spells',
            'data/talents', 'data/session_sod', 'data/presets', 'globals', 'profiles', 'settings', 'stats', 'ui'],
    };
    assert.deepEqual(Object.keys(entrypoints), ['classic', 'sod']);
    for (const [mode, page] of [['classic', 'classic.html'], ['sod', 'index.html']]) {
        assert.deepEqual(entrypoints[mode], expected[mode].map(file => `js/${file}.min.js`));
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        assert.match(html, new RegExp(`var mode = ["']${mode}["']`));
        const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["'](dist\/[^"]+?)["']/g)].map(match => match[1]);
        assert.deepEqual(scripts, ['dist/js/bundle-loader.min.js']);
        assert.ok(html.indexOf('var mode') < html.indexOf('dist/js/bundle-loader.min.js'));
        assert.ok(html.indexOf('simulatorReady.then') < html.indexOf('SIM.UI.init()'));
    }
});

test('tampered manifests and changed asset bytes cannot start a mixed bundle', async t => {
    const root = workspace(t);
    const manifest = buildBundle(root);
    const legacy = load(root, {...manifest, format: 1});
    await assert.rejects(legacy.context.simulatorReady, /Unsupported simulation bundle manifest/);
    assert.equal(legacy.loaded.length, 0);
    const wrong = structuredClone(manifest);
    wrong.entrypoints.sod.reverse();
    const tampered = load(root, wrong);
    await assert.rejects(tampered.context.simulatorReady, /hash mismatch/);
    assert.equal(tampered.loaded.length, 0);
    const file = path.join(root, 'dist/bundles', manifest.buildId, 'wasm/warriorsim.wasm');
    fs.appendFileSync(file, Buffer.from([0]));
    const corrupted = load(root);
    await assert.rejects(corrupted.context.simulatorReady, /Bundle asset hash mismatch/);
    assert.equal(corrupted.loaded.length, 0, 'even UI scripts wait for the WASM integrity check');
    assert.equal(corrupted.blobs.size, 0);
    assert.throws(() => buildBundle(root), /Immutable bundle was modified/);
});

test('missing assets block startup and script-load failures release retained bytes', async t => {
    const root = workspace(t);
    const manifest = buildBundle(root);
    const failed = load(root, undefined, 'sod', {scriptFailure: true});
    await assert.rejects(failed.context.simulatorReady, /Could not load bundle asset/);
    assert.equal(failed.blobs.size, 0);
    const unused = path.join(root, 'dist/bundles', manifest.buildId, 'js/data/gear.min.js');
    fs.renameSync(unused, unused + '.offline');
    const missing = load(root);
    await assert.rejects(missing.context.simulatorReady, /Could not preload bundle asset/);
    assert.equal(missing.loaded.length, 0, 'all assets are required, including the other page variant');
    assert.equal(missing.blobs.size, 0);
});
