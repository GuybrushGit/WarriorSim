'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
    createConfiguredPlayer,
    createState,
    createReferenceEngine,
    loadFixtures,
    runReference,
} = require('./reference-engine');

const ROOT = path.resolve(__dirname, '..', '..');

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function createHarness() {
    class FakeWorker {
        static instances = [];

        constructor(url) {
            this.url = url;
            this.messages = [];
            this.terminateCount = 0;
            FakeWorker.instances.push(this);
        }

        postMessage(value) {
            this.messages.push(value);
        }

        terminate() {
            ++this.terminateCount;
        }

        emit(...data) {
            this.onmessage({data});
        }
    }

    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        Worker: FakeWorker,
        crypto: {
            getRandomValues(values) {
                values[0] = 0xdecafbad;
                return values;
            },
        },
        getGlobalsDelta() {
            return {sod: false, testMarker: 42};
        },
    });
    const source = fs.readFileSync(path.join(ROOT, 'js/classes/simulation.js'), 'utf8');
    vm.runInContext(`${source}\n;globalThis.__workerTestApi = {
        SimulationWorker,
        SimulationWorkerParallel,
        mergeSimulationReports,
        normalizeSimulationWorkerParams,
    };`, context, {filename: 'simulation.js'});
    return {api: context.__workerTestApi, FakeWorker};
}

function jqueryConfigStub(values) {
    return selector => ({
        addClass() { return this; },
        click() { return this; },
        prop() { return false; },
        removeClass() { return this; },
        text() { return this; },
        val() { return values[selector]; },
    });
}

function loadMinified(context, relativePath) {
    const filename = path.join(ROOT, 'dist', 'js', relativePath);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
}

function evaluateBuiltWorker(source = false) {
    const workerPath = source ? path.join(ROOT, 'js', 'sim-worker.js') : path.join(ROOT, 'dist', 'js', 'sim-worker.min.js');
    let context;
    context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        URL,
        location: {href: 'https://example.test/WarriorSim/dist/js/sim-worker.min.js'},
        postMessage() {},
        importScripts(...relativePaths) {
            for (const relativePath of relativePaths) {
                const asset = new URL(relativePath, context.location.href).pathname.replace('/WarriorSim/dist/', '');
                const filename = path.join(ROOT, source ? asset.replace(/\.min\.js$/, '.js') : path.join('dist', asset));
                vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
            }
        },
    });
    context.self = context;
    vm.runInContext(fs.readFileSync(workerPath, 'utf8'), context, {
        filename: workerPath,
        importModuleDynamically() { throw new Error('dynamic import is not used while loading the worker'); },
    });
    return context;
}

function createMinifiedContext(fixture, FakeWorker, includeSession) {
    const target = fixture.player.target;
    const values = {
        'input[name="level"]': String(fixture.player.level),
        'select[name="race"]': fixture.player.race,
        'select[name="aqbooks"]': fixture.player.aqbooks ? 'Yes' : 'No',
        'input[name="reactionmin"]': String(fixture.player.reactionmin),
        'input[name="reactionmax"]': String(fixture.player.reactionmax),
        'input[name="adjacent"]': String(fixture.player.adjacent),
        'select[name="spellqueueing"]': fixture.player.spellqueueing ? 'Yes' : 'No',
        'input[name="targetlevel"]': String(target.level),
        'select[name="targetbasearmor"]': String(target.basearmor),
        'input[name="targetcustomarmor"]': '',
        'input[name="targetresistance"]': String(target.resistance),
        'input[name="targetspeed"]': String(target.speed / 1000),
        'input[name="targetmindmg"]': String(target.mindmg),
        'input[name="targetmaxdmg"]': String(target.maxdmg),
        'select[name="bleedreduction"]': String(target.bleedreduction),
    };
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        Worker: FakeWorker,
        crypto: {getRandomValues(array) { array[0] = 0xdecafbad; return array; }},
        window: {location: {href: fixture.mode === 'sod' ? 'index.html' : 'classic.html'}},
        mode: fixture.mode,
        $: jqueryConfigStub(values),
    });
    const sources = [
        fixture.mode === 'sod' ? 'data/gear_sod.min.js' : 'data/gear.min.js',
        'data/enchants.min.js',
        'data/talents.min.js',
        'data/spells.min.js',
        'data/buffs.min.js',
        ...(fixture.mode === 'sod' ? ['data/runes.min.js'] : []),
        ...(includeSession ? [fixture.mode === 'sod' ? 'data/session_sod.min.js' : 'data/session.min.js'] : []),
        'data/levelstats.min.js',
        'classes/player.min.js',
        'classes/simulation.min.js',
        'compute-protocol.min.js',
        'shared-compute.min.js',
        'classes/spell.min.js',
        'classes/weapon.min.js',
        'globals.min.js',
    ];
    for (const source of sources) loadMinified(context, source);
    vm.runInContext(`globalThis.__minifiedApi = {
        configure(value) { updateGlobals(value); },
        defaultState() {
            return {
                talents: session.talents,
                buffs: session.buffs,
                rotation: session.rotation,
                gear: session.gear,
                enchant: session.enchant,
                runes: session.runes || {},
                resistances: session.resistance || {},
            };
        },
        playerConfig() { return Player.getConfig(); },
        start(params) {
            const worker = new SimulationWorker(() => {}, () => {}, error => { throw error; });
            worker.start(params);
        },
        setupWorker(request) {
            updateGlobals(request.globals);
            setSimulationSeed(request.sim.seed);
            const player = new Player(...request.player);
            return player.serializeSimulationSpec(request.sim);
        },
        sharedSpec(request) { return resolveSharedSimulationSpec(request); },
        catalogs() { return JSON.stringify({spells, buffs, gear, runes: globalThis.runes}); },
    };`, context);
    return context;
}

function params(overrides = {}) {
    return {
        player: [null, null, null, {logging: false}],
        sim: {
            timesecsmin: 10,
            timesecsmax: 10,
            executeperc: 20,
            startrage: 0,
            iterations: 4,
            batching: 10,
            ...overrides,
        },
        fullReport: true,
    };
}

function report(iterations, damage, executeRage, starttime, endtime) {
    return {
        iterations,
        totaldmg: damage,
        totalduration: iterations * 10,
        mindps: damage / (iterations * 10) - 1,
        maxdps: damage / (iterations * 10) + 1,
        sumdps: damage / 10,
        sumdps2: damage * damage / 100,
        starttime,
        endtime,
        spread: {[Math.round(damage / (iterations * 10))]: iterations},
        player: {
            auras: {
                deathwish: {uptime: iterations * 1000, data: [iterations], totaldmg: 0},
            },
            spells: {
                execute: {totaldmg: damage / 2, totalusedrage: executeRage, data: [iterations, 0, 0, 0, 0]},
            },
            mh: {totaldmg: damage / 2, totalprocdmg: iterations, data: [iterations, 0, 0, 0, 0]},
            oh: null,
        },
    };
}

test('direct workers generate and forward one normalized seed without mutating input', () => {
    const {api, FakeWorker} = createHarness();
    let finished;
    let error;
    const worker = new api.SimulationWorker(value => { finished = value; }, () => {}, value => { error = value; });
    const input = params({iterations: 3});

    worker.start(input);

    assert.equal(FakeWorker.instances.length, 1);
    const nativeRequest = FakeWorker.instances[0].messages[0];
    assert.equal(nativeRequest.sim.seed, 0xdecafbad);
    assert.equal(nativeRequest.sim.iterationOffset, 0);
    assert.equal(nativeRequest.sim.iterations, 3);
    assert.deepEqual(plain(nativeRequest.globals), {sod: false, testMarker: 42});
    assert.equal(input.sim.seed, undefined);
    assert.equal(input.sim.iterationOffset, undefined);

    const result = report(3, 300, 25, 10, 20);
    FakeWorker.instances[0].emit(1, result);
    assert.equal(finished, result);
    assert.equal(error, undefined);
    assert.equal(FakeWorker.instances[0].terminateCount, 1);
});

for (const mode of ['classic', 'sod']) test(`deployed minified ${mode} setup preserves page mode and worker execution spec`, () => {
    class FakeWorker {
        static instances = [];
        constructor(url) { this.url = url; this.messages = []; FakeWorker.instances.push(this); }
        postMessage(value) { this.messages.push(value); }
        terminate() {}
    }
    const fixture = loadFixtures().find(value => value.mode === mode);
    const page = createMinifiedContext(fixture, FakeWorker, true);
    const reference = createReferenceEngine(fixture.mode);
    const state = createState(reference, fixture);
    page.__minifiedApi.configure(state);
    const playerConfig = plain(page.__minifiedApi.playerConfig());
    page.__minifiedApi.start({
        player: [null, null, null, playerConfig],
        sim: fixture.sim,
        fullReport: true,
    });

    const request = plain(FakeWorker.instances[0].messages[0]);
    assert.equal(FakeWorker.instances[0].url, './dist/js/sim-worker.min.js');
    assert.equal(request.player[3].mode, mode);
    assert.equal(request.globals.sod, mode === 'sod');

    const worker = createMinifiedContext(fixture, FakeWorker, false);
    worker.__request = request;
    const minifiedSpec = plain(worker.__minifiedApi.setupWorker(worker.__request));
    const sourceEngine = createReferenceEngine(fixture.mode);
    sourceEngine.configure(request.globals);
    sourceEngine.rngSequence(request.sim.seed, 0);
    const sourcePlayer = sourceEngine.createPlayer(request.player[3]);
    assert.equal(request.sim.iterationOffset, 0);
    const sourceSpec = plain(sourcePlayer.serializeSimulationSpec(request.sim));

    assert.equal(minifiedSpec.player.props.mode, mode);
    assert.deepEqual(minifiedSpec, sourceSpec);
});

test('parallel workers partition a shared seed and offset when iterations are fewer than workers', () => {
    const {api, FakeWorker} = createHarness();
    const updates = [];
    let finished;
    const parallel = new api.SimulationWorkerParallel(
        4,
        value => { finished = value; },
        (iteration, value) => updates.push({iteration, value: plain(value)}),
        error => assert.fail(error && error.message || error),
    );

    parallel.start(params({iterations: 2, seed: 1234, iterationOffset: 9}));

    assert.equal(parallel.workers.length, 2);
    assert.deepEqual(FakeWorker.instances.slice(0, 2).map(worker => plain(worker.messages[0].sim)), [
        {timesecsmin: 10, timesecsmax: 10, executeperc: 20, startrage: 0, iterations: 1, batching: 10, seed: 1234, iterationOffset: 9},
        {timesecsmin: 10, timesecsmax: 10, executeperc: 20, startrage: 0, iterations: 1, batching: 10, seed: 1234, iterationOffset: 10},
    ]);
    assert.equal(FakeWorker.instances[0].messages[0].player[3].logging, true);
    assert.equal(FakeWorker.instances[1].messages[0].player[3].logging, false);
    assert.deepEqual(plain(FakeWorker.instances[2].messages[0]), {type: 'cancel'});
    assert.deepEqual(plain(FakeWorker.instances[3].messages[0]), {type: 'cancel'});

    FakeWorker.instances[0].emit(0, 1, {iterations: 1, totaldmg: 90, totalduration: 10});
    assert.deepEqual(updates.at(-1), {
        iteration: 1,
        value: {iterations: 2, totaldmg: 90, totalduration: 10},
    });

    FakeWorker.instances[0].emit(1, report(1, 90, 8, 20, 30));
    FakeWorker.instances[1].emit(1, report(1, 110, 12, 10, 40));
    assert.equal(finished.iterations, 2);
    assert.equal(finished.totaldmg, 200);
    assert.equal(finished.starttime, 10);
    assert.equal(finished.endtime, 40);
    assert.equal(finished.player.spells.execute.totalusedrage, 20);
});

test('batch reports merge extrema, progress counters, weapons, auras, and execute rage', () => {
    const {api} = createHarness();
    const first = report(2, 180, 11, 30, 40);
    const second = report(3, 360, 17, 10, 50);

    const merged = api.mergeSimulationReports(
        api.mergeSimulationReports(undefined, first),
        second,
    );

    assert.equal(merged.iterations, 5);
    assert.equal(merged.totaldmg, 540);
    assert.equal(merged.totalduration, 50);
    assert.equal(merged.mindps, Math.min(first.mindps, second.mindps));
    assert.equal(merged.maxdps, Math.max(first.maxdps, second.maxdps));
    assert.equal(merged.starttime, 10);
    assert.equal(merged.endtime, 50);
    assert.equal(merged.player.spells.execute.totaldmg, 270);
    assert.equal(merged.player.spells.execute.totalusedrage, 28);
    assert.deepEqual(plain(merged.player.spells.execute.data), [5, 0, 0, 0, 0]);
    assert.equal(merged.player.auras.deathwish.uptime, 5000);
    assert.equal(merged.player.mh.totaldmg, 270);
    assert.equal(merged.player.mh.totalprocdmg, 5);
});

test('the first worker error cancels every sibling and is reported once', () => {
    const {api, FakeWorker} = createHarness();
    const errors = [];
    const parallel = new api.SimulationWorkerParallel(3, () => {}, () => {}, error => errors.push(error));
    parallel.start(params({iterations: 6, seed: 99}));

    const failure = {message: 'native failure'};
    FakeWorker.instances[1].emit(2, failure);

    assert.equal(errors.length, 1);
    assert.equal(errors[0], failure);
    assert.ok(FakeWorker.instances.every(worker => worker.terminateCount >= 1));
    assert.ok(FakeWorker.instances.every(worker =>
        worker.messages.some(message => message && message.type === 'cancel')));

    FakeWorker.instances[2].emit(2, {message: 'late failure'});
    assert.equal(errors.length, 1);
});

test('fractional and non-finite iteration requests fail before worker dispatch', () => {
    const {api, FakeWorker} = createHarness();
    const errors = [];
    const worker = new api.SimulationWorker(() => {}, () => {}, error => errors.push(error));

    worker.start(params({iterations: 0.5}));

    assert.equal(FakeWorker.instances[0].messages.length, 0);
    assert.equal(FakeWorker.instances[0].terminateCount, 1);
    assert.match(errors[0].message, /positive unsigned 32-bit integer/);
    assert.throws(() => api.normalizeSimulationWorkerParams(params({iterations: Number.NaN})),
        /positive unsigned 32-bit integer/);
    assert.throws(() => api.normalizeSimulationWorkerParams(params({iterations: Number.POSITIVE_INFINITY})),
        /positive unsigned 32-bit integer/);
    assert.throws(() => api.normalizeSimulationWorkerParams(params({iterations: 0x100000000})),
        /positive unsigned 32-bit integer/);
    assert.throws(() => api.normalizeSimulationWorkerParams(params({iterations: 2, iterationOffset: 0xFFFFFFFF})),
        /range exceeds/);
    assert.throws(() => api.normalizeSimulationWorkerParams(params({iterations: 1, seed: 0x100000000})),
        /unsigned 32-bit integer/);
});

test('worker errors normalize Emscripten exception arrays to readable strings', () => {
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        URL,
        self: {location: {href: 'https://example.test/WarriorSim/dist/js/sim-worker.min.js'}},
        importScripts() {},
        postMessage() {},
    });
    const source = fs.readFileSync(path.join(ROOT, 'js/sim-worker.js'), 'utf8');
    vm.runInContext(`${source}\n;globalThis.__errorPayload = errorPayload;`, context, {
        filename: 'sim-worker.js',
        importModuleDynamically() { throw new Error('dynamic import is not used by this test'); },
    });

    const payload = plain(context.__errorPayload({
        name: 'WebAssembly.Exception',
        message: ['std::runtime_error', {what: 'unsupported aura kind: Example'}],
        stack: 'native stack',
    }));
    assert.deepEqual(payload, {
        name: 'WebAssembly.Exception',
        message: 'std::runtime_error: unsupported aura kind: Example',
        stack: 'native stack',
    });
});

test('built worker and all importScripts dependencies evaluate in one worker global scope', () => {
    const context = evaluateBuiltWorker();
    assert.equal(typeof context.self.onmessage, 'function');
});

for (const source of [true, false]) for (const mode of ['classic','sod']) test(`${source ? 'source' : 'dist'} worker executes ${mode} rule loading and uneven native batch route`,async()=>{
 const fixture=loadFixtures().find(f=>f.mode===mode),context=evaluateBuiltWorker(source);
 const engine=createReferenceEngine(mode),calls=[],messages=[];let destroyed=0;
 context.postMessage=value=>messages.push(plain(value));
 context.__native={
  createEngine(json,seed){const spec=JSON.parse(json);assert.equal(spec.player.props.mode,mode);assert.equal(seed,fixture.sim.seed);return 7;},
  runBatch(handle,count,offset,full){assert.equal(handle,7);assert.equal(full,true);calls.push([count,offset]);return JSON.stringify(runReference(fixture,{sim:{iterations:count,iterationOffset:offset}}));},
  destroyEngine(handle){assert.equal(handle,7);destroyed++;},
 };
 vm.runInContext('loadWarriorSim = async () => globalThis.__native; globalThis.__run = run;',context);
 await context.__run({player:[null,null,null,{...fixture.player,mode}],sim:{...fixture.sim,iterations:5,iterationOffset:11},globals:{...createState(engine,fixture),sod:mode==='sod'},fullReport:true,batchSize:2});
 assert.deepEqual(calls,[[2,11],[2,13],[1,15]]);assert.equal(destroyed,1);
 const final=messages.at(-1)[1];assert.equal(final.iterations,5);assert.ok(final.player.mh.totaldmg>0);
});

for (const mode of ['classic', 'sod']) test(`${mode} shared stat weights and item rows preserve page catalogs and match real local WASM`, {timeout: 20000}, async t => {
    const {deployedWorkers, request: execute} = require('../compute/worker-harness');
    const {Worker, url} = deployedWorkers();
    t.after(() => Promise.all(Worker.all.map(worker => worker.terminate())));
    const fixture = structuredClone(loadFixtures().find(value =>
        value.name === (mode === 'sod' ? 'sod-dw-runes' : 'classic-dw-fury')));
    fixture.buffsAdd = [...fixture.buffsAdd || [], 20906];
    fixture.rotation = {...fixture.rotation, 20130: {active: false, timetoendactive: false, timetostartactive: false}};
    const state = createState(createReferenceEngine(mode), fixture);
    const page = createMinifiedContext(fixture, class {}, true);
    page.__minifiedApi.configure(plain(state));
    const originalCatalogs = page.__minifiedApi.catalogs();
    const sim = {...fixture.sim, iterations: 17, iterationOffset: 31};
    const sharedWorker = new Worker(url('js/compute-worker.min.js'));
    let baseline;
    for (const [name, args] of [
        ['base', [null, null, null]], ['attack power', [40, 0, 3]], ['crit', [1, 1, 3]],
        ['hit', [1, 2, 3]], ['strength', [20, 3, 3]], ['agility', [20, 4, 3]],
        ['item row', [20130, 'trinket1', 0]], ['base after item', [null, null, null]],
    ]) {
        const input = {player: [...args, {...plain(fixture.player), mode}], sim: plain(sim),
            globals: {...plain(state), sod: mode === 'sod'}, fullReport: true};
        const before = JSON.stringify(input);
        const spec = plain(page.__minifiedApi.sharedSpec(input));
        assert.equal(JSON.stringify(input), before, `${name}: caller configuration is immutable`);
        assert.equal(page.__minifiedApi.catalogs(), originalCatalogs, `${name}: page catalogs are unchanged`);
        const localContext = createMinifiedContext(fixture, class {}, false);
        const expectedSpec = plain(localContext.__minifiedApi.setupWorker(plain(input)));
        // Native runBatch initializes this random reaction timer afresh for every iteration.
        const stableSpec = value => JSON.parse(JSON.stringify(value, (key, entry) => key === 'unqueuetimer' ? undefined : entry));
        assert.deepEqual(stableSpec(spec), stableSpec(expectedSpec), `${name}: shared and local resolved spec`);
        const localWorker = new Worker(url('js/sim-worker.min.js'));
        const local = await execute(localWorker, input, true);
        await localWorker.terminate();
        const shared = await execute(sharedWorker, {id: name, jobId: `variant-${name}`, spec,
            seed: sim.seed, count: sim.iterations, offset: sim.iterationOffset, fullReport: true});
        for (const key of ['iterations', 'totaldmg', 'totalduration', 'sumdps', 'sumdps2', 'mindps', 'maxdps']) {
            assert.equal(shared[key], local[key], `${name}: ${key}`);
        }
        assert.deepEqual(shared.player, local.player, `${name}: complete combat counters`);
        assert.deepEqual(shared.spread, Object.fromEntries(Object.entries(local.spread)), `${name}: spread`);
        if (name === 'base') baseline = shared;
        if (name === 'base after item') {
            assert.equal(shared.totaldmg, baseline.totaldmg);
            assert.deepEqual(shared.player, baseline.player, 'item rows cannot affect subsequent base simulations');
        }
        if (name === 'item row') assert.ok(shared.player.auras.flask, 'the item row must activate Diamond Flask');
    }
});
