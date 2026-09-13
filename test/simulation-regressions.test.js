'use strict';

const assert = require('assert').strict;
const {loadSimulation, createPlayer, runFights} = require('./helpers/simulation');
const tests = [];

function test(name, callback) {
    tests.push({name, callback});
}

function makeResetPlayer(Player, overrides = {}) {
    const player = Object.create(Player.prototype);
    Object.assign(player, {
        reactionmin: 100,
        reactionmax: 200,
        stats: {haste: 1},
        mh: {timer: 999},
        oh: null,
        spells: {},
        auras: {},
        trinketproc1: null,
        trinketproc2: null,
        initStances() {},
        update() {},
    }, overrides);
    return player;
}

function makeReport({maxdps = 0, endtime = 0, totalusedrage} = {}) {
    const report = {
        iterations: 1,
        totaldmg: 100,
        totalduration: 10,
        mindps: 10,
        maxdps,
        sumdps: 10,
        sumdps2: 100,
        starttime: 1,
        endtime,
    };
    if (totalusedrage !== undefined) {
        report.player = {
            auras: {},
            spells: {
                execute: {totaldmg: 50, totalusedrage, data: [1, 0, 0, 0, 0]},
            },
            mh: {totaldmg: 50, totalprocdmg: 0, data: [1, 0, 0, 0, 0]},
            oh: null,
        };
    }
    return report;
}

function mergeReports(SimulationWorkerParallel, first, second) {
    let result;
    const parallel = Object.create(SimulationWorkerParallel.prototype);
    parallel.states = [
        {status: 1, data: first},
        {status: 1, data: second},
    ];
    parallel.callback_finished = value => { result = value; };
    parallel.callback_update = () => {};
    parallel.update();
    return result;
}

test('reset clears a free Shield Slam proc between fights', () => {
    const {Player} = loadSimulation();
    const player = makeResetPlayer(Player, {freeshieldslam: true});

    player.reset(0);

    assert.equal(player.freeshieldslam, false);
});

test('reset clears mutable spell state between fights', () => {
    const {Player} = loadSimulation();
    const spell = {
        timer: 5000,
        stacks: 3,
        maxdelay: 999,
        unqueuetimer: 999,
        usedrage: 47,
        backupheroic: {maxdelay: 999, unqueuetimer: 999},
    };
    const player = makeResetPlayer(Player, {spells: {execute: spell}});

    player.reset(0);

    assert.equal(spell.timer, 0);
    assert.equal(spell.stacks, 0);
    assert.equal(spell.maxdelay, player.reactionmin);
    assert.equal(spell.usedrage, 0);
    assert.ok(spell.unqueuetimer >= 300 + player.reactionmin);
    assert.ok(spell.unqueuetimer <= 300 + player.reactionmax);
    assert.equal(spell.backupheroic.maxdelay, player.reactionmin);
    assert.ok(spell.backupheroic.unqueuetimer >= 300 + player.reactionmin);
    assert.ok(spell.backupheroic.unqueuetimer <= 300 + player.reactionmax);
});

test('reset clears mutable aura state between fights', () => {
    const {Player} = loadSimulation();
    const aura = {
        timer: 5000,
        firstuse: false,
        stacks: 3,
        starttimer: 450,
        maxdelay: 999,
        mintime: 700,
        ticksleft: 4,
        saveddmg: 120,
        nexttick: 1000,
        cooldowntimer: 6000,
        tfbstep: 3000,
    };
    const player = makeResetPlayer(Player, {auras: {testaura: aura}});

    player.reset(0);

    assert.deepEqual({
        timer: aura.timer,
        firstuse: aura.firstuse,
        stacks: aura.stacks,
        starttimer: aura.starttimer,
        maxdelay: aura.maxdelay,
        mintime: aura.mintime,
        ticksleft: aura.ticksleft,
        saveddmg: aura.saveddmg,
        nexttick: aura.nexttick,
        cooldowntimer: aura.cooldowntimer,
        tfbstep: aura.tfbstep,
    }, {
        timer: 0,
        firstuse: true,
        stacks: 0,
        starttimer: 0,
        maxdelay: player.reactionmin,
        mintime: 0,
        ticksleft: 0,
        saveddmg: 0,
        nexttick: 0,
        cooldowntimer: 0,
        tfbstep: -6000,
    });
});

test('reset schedules the initial off-hand swing using refreshed haste', () => {
    const {Player} = loadSimulation();
    const player = makeResetPlayer(Player, {
        oh: {speed: 2, timer: 999},
        update() { this.stats.haste = 2; },
    });

    player.reset(0);

    assert.equal(player.oh.timer, 500);
});

test('parallel reports retain the highest DPS result', () => {
    const {SimulationWorkerParallel} = loadSimulation();
    const result = mergeReports(
        SimulationWorkerParallel,
        makeReport({maxdps: 125}),
        makeReport({maxdps: 275}),
    );

    assert.equal(result.maxdps, 275);
});

test('parallel reports retain the latest worker completion time', () => {
    const {SimulationWorkerParallel} = loadSimulation();
    const result = mergeReports(
        SimulationWorkerParallel,
        makeReport({endtime: 100}),
        makeReport({endtime: 250}),
    );

    assert.equal(result.endtime, 250);
});

test('parallel reports add spell rage usage from every worker', () => {
    const {SimulationWorkerParallel} = loadSimulation();
    const result = mergeReports(
        SimulationWorkerParallel,
        makeReport({totalusedrage: 40}),
        makeReport({totalusedrage: 65}),
    );

    assert.equal(result.player.spells.execute.totalusedrage, 105);
});

test('parallel workers receive one seed and contiguous iteration offsets', () => {
    const {SimulationWorkerParallel} = loadSimulation();
    const starts = [];
    const parallel = Object.create(SimulationWorkerParallel.prototype);
    parallel.workers = [0, 1, 2].map(() => ({start: params => starts.push(params)}));

    parallel.start({
        sim: {iterations: 10, seed: 0x12345678, iterationOffset: 7},
        player: [null, null, null, {}],
        fullReport: false,
    });

    assert.deepEqual(starts.map(params => params.sim.iterations), [3, 4, 3]);
    assert.deepEqual(starts.map(params => params.sim.iterationOffset), [7, 10, 14]);
    assert.deepEqual(starts.map(params => params.sim.seed), [0x12345678, 0x12345678, 0x12345678]);
});

test('seed zero is valid and the random stream has stable reference values', () => {
    const {
        simulationIterationSeed,
        setSimulationSeed,
        simulationRandom,
    } = loadSimulation();
    assert.equal(typeof simulationIterationSeed, 'function');
    assert.equal(typeof setSimulationSeed, 'function');
    assert.equal(typeof simulationRandom, 'function');

    setSimulationSeed(0);
    assert.deepEqual([simulationRandom(), simulationRandom(), simulationRandom()], [
        0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
    assert.equal(simulationIterationSeed(0xffffffff, 1), 0x9e3779b8);
});

test('parallel jobs without an explicit seed generate one shared seed', () => {
    const api = loadSimulation();
    api.evaluate('this.crypto = {getRandomValues: values => { values[0] = 12345; return values; }}');
    const starts = [];
    const parallel = Object.create(api.SimulationWorkerParallel.prototype);
    parallel.workers = [0, 1].map(() => ({start: params => starts.push(params)}));
    parallel.start({sim: {iterations: 4}, player: [null, null, null, {}], fullReport: false});
    assert.deepEqual(starts.map(params => params.sim.seed), [12345, 12345]);
});

test('glancing damage uses the deterministic simulation stream', () => {
    const {Player, setSimulationSeed, simulationRandom} = loadSimulation();
    assert.equal(typeof setSimulationSeed, 'function');
    assert.equal(typeof simulationRandom, 'function');

    const seed = 0x89ABCDEF;
    setSimulationSeed(seed);
    const roll = simulationRandom();
    setSimulationSeed(seed);

    const player = Object.create(Player.prototype);
    player.mode = 'classic';
    player.target = {defense: 315};
    player.stats = {skill_3: 300};
    const low = 0.55;
    const high = 0.75;

    assert.ok(Math.abs(player.getGlanceReduction({type: 3}) - (roll * (high - low) + low)) < 1e-15);
});

test('unseeded rolls use Math.random after a seeded run', () => {
    const api = loadSimulation();
    api.evaluate('Math.random = () => 0.5');
    api.setSimulationSeed(0);
    api.simulationRandom();
    api.setSimulationSeed(null);
    assert.equal(api.rng(10, 20), 15);
    assert.equal(api.rng10k(), 5000);
    assert.equal(api.simulationRandom(), 0.5);
});

test('new players initialize the shared Shield Slam proc flag', () => {
    const api = loadSimulation(true);
    assert.equal(createPlayer(api).freeshieldslam, false);
});

test('an unused Sword and Board proc cannot pay for Shield Slam in the next fight', () => {
    const api = loadSimulation(true);
    const player = createPlayer(api);
    // This flag belongs to the shared SoD path; its reset does not enable a rune in Classic.
    player.freeshieldslam = true;
    player.reset(50);
    const spell = new api.ShieldSlam(player, 23922);
    const rageBefore = player.rage;
    spell.use();
    assert.equal(player.rage, rageBefore - spell.cost);
});

test('Cleave resets the hidden Heroic Strike used by its Execute macro', () => {
    const api = loadSimulation(true);
    const player = createPlayer(api, true);
    assert.ok(player.spells.cleave.backupheroic);
    assert.equal(player.spells.heroicstrike, undefined);
    const backup = player.spells.cleave.backupheroic;
    backup.maxdelay = 900;
    backup.unqueuetimer = 900;
    player.reset(35);
    assert.equal(backup.maxdelay, player.reactionmin);
    assert.ok(backup.unqueuetimer >= 400 && backup.unqueuetimer <= 500);
});

function assertClose(actual, expected, key = 'report') {
    if (typeof expected === 'number') {
        assert.ok(Number.isFinite(actual), `${key} must be finite`);
        const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-12);
        assert.ok(Math.abs(actual - expected) <= tolerance, `${key}: ${actual} != ${expected}`);
    } else if (expected && typeof expected === 'object') {
        assert.deepEqual(Object.keys(actual), Object.keys(expected), `${key} keys`);
        for (const child of Object.keys(expected)) assertClose(actual[child], expected[child], `${key}.${child}`);
    } else {
        assert.equal(actual, expected, key);
    }
}

function assertCombatActivity(report, cleave) {
    const spells = report.player.spells;
    for (const key of ['execute', cleave ? 'cleave' : 'bloodthirst']) {
        assert.ok(spells[key].totaldmg > 0, `${key} must deal damage`);
    }
    assert.ok(spells.execute.totalusedrage > 0, 'Execute must spend excess rage');
    assert.ok(report.player.auras.flurry.uptime > 0, 'Flurry must change haste');
    assert.ok(report.player.mh.data[4] > 0, 'fixture must roll glancing blows');
}

for (const cleave of [false, true]) {
    const label = cleave ? 'Classic Cleave' : 'Classic Fury';
    test(`${label} repeats the complete combat report with a fixed seed`, () => {
        const first = runFights({cleave});
        assertCombatActivity(first, cleave);
        assert.deepEqual(runFights({cleave}), first);
    });

    test(`${label} preserves all combat counters across uneven fresh-worker partitions`, () => {
        const single = runFights({cleave, iterationOffset: 7});
        const {SimulationWorkerParallel} = loadSimulation();
        const chunks = [[3, 7], [5, 10], [4, 15]].map(([iterations, iterationOffset]) =>
            runFights({cleave, iterations, iterationOffset}));
        let merged = chunks.shift();
        for (const chunk of chunks) merged = mergeReports(SimulationWorkerParallel, merged, chunk);
        delete merged.starttime;
        delete merged.endtime;
        assertCombatActivity(single, cleave);
        assertClose(merged, single);
    });
}

test('manual and asynchronous execution use the same per-fight seeds as synchronous execution', () => {
    const options = {seed: 0, iterationOffset: 17};
    const synchronous = runFights(options);
    assert.deepEqual(runFights({...options, execution: 'manual'}), synchronous);
    assert.deepEqual(runFights({...options, execution: 'async'}), synchronous);
});

let failures = 0;
for (const {name, callback} of tests) {
    try {
        callback();
        console.log(`PASS ${name}`);
    } catch (error) {
        ++failures;
        console.error(`FAIL ${name}`);
        console.error(error.stack || error);
    }
}
if (failures) {
    console.error(`${failures} of ${tests.length} tests failed`);
    process.exitCode = 1;
} else {
    console.log(`${tests.length} tests passed`);
}
