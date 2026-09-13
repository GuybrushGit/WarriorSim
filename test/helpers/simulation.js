'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {execFileSync} = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

// Read an older revision in memory for negative controls, leaving the checkout intact.
function readSource(relativePath) {
    if (process.argv.includes('--dist')) {
        relativePath = 'dist/' + relativePath.replace(/\.js$/, '.min.js');
    }
    if (process.env.SIM_SOURCE_REF) {
        return execFileSync('git', ['show', process.env.SIM_SOURCE_REF + ':' + relativePath], {
            cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
        });
    }
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadSimulation(full = false) {
    const context = vm.createContext({
        console,
        getGlobalsDelta: () => ({}),
        setTimeout,
        clearTimeout,
        Worker: class {},
        window: {location: {href: 'classic.html'}},
        $: () => ({prop: () => false, text() { return this; }}),
    });
    const sources = ['js/classes/simulation.js', 'js/classes/player.js'];
    if (full) sources.push(
        'js/data/gear.js', 'js/data/enchants.js', 'js/data/talents.js',
        'js/data/spells.js', 'js/data/buffs.js', 'js/data/levelstats.js',
        'js/data/session.js', 'js/classes/spell.js', 'js/classes/weapon.js', 'js/globals.js',
    );
    for (const relativePath of sources) {
        vm.runInContext(readSource(relativePath), context, {filename: relativePath});
    }
    const api = vm.runInContext(`({
        Player, Simulation, SimulationWorkerParallel,
        getGlobalsDelta,
        generateSimulationSeed: typeof generateSimulationSeed === 'function' ? generateSimulationSeed : undefined,
        simulationIterationSeed: typeof simulationIterationSeed === 'function' ? simulationIterationSeed : undefined,
        setSimulationSeed: typeof setSimulationSeed === 'function' ? setSimulationSeed : undefined,
        simulationRandom: typeof simulationRandom === 'function' ? simulationRandom : undefined,
        rng, rng10k,
    })`, context);
    api.evaluate = source => vm.runInContext(source, context);
    if (full) {
        // Use this repo's Classic catalog and saved character; no private-server data.
        vm.runInContext('updateGlobals(session)', context);
        api.Cleave = vm.runInContext('Cleave', context);
        api.ShieldSlam = vm.runInContext('ShieldSlam', context);
    }
    return api;
}

const config = {
    level: 60, race: 'Human', aqbooks: false, reactionmin: 100, reactionmax: 200,
    adjacent: 0, mode: 'classic', spellqueueing: false, logging: false,
    target: {level: 63, defense: 315, basearmor: 3731, resistance: 24,
        speed: 0, mindmg: 200, maxdmg: 300, bleedreduction: '1'},
};

function createPlayer(api, cleave = false) {
    if (cleave) api.evaluate(`
        for (const spell of spells) {
            if (spell.classname === 'HeroicStrike') spell.active = false;
            if (spell.id == 20569) Object.assign(spell, {
                active: true, exmacro: true, minrage: 30, minrageactive: true,
                unqueue: 15, unqueueactive: true,
            });
        }
    `);
    const playerConfig = JSON.parse(JSON.stringify(config));
    if (cleave) playerConfig.adjacent = 1;
    const player = new api.Player(undefined, undefined, undefined, playerConfig);
    assert.ok(player.mh && player.oh, 'fixture must equip both hands');
    return player;
}

function snapshot(player) {
    const result = {auras: {}, spells: {}};
    for (const group of ['auras', 'spells']) {
        for (const key of Object.keys(player[group])) {
            const action = player[group][key];
            result[group][key] = {
                totaldmg: action.totaldmg || 0, uptime: action.uptime || 0,
                totalusedrage: action.totalusedrage || 0,
                data: Array.from(action.data || []),
            };
        }
    }
    for (const hand of ['mh', 'oh']) {
        result[hand] = {
            totaldmg: player[hand].totaldmg, totalprocdmg: player[hand].totalprocdmg,
            data: Array.from(player[hand].data),
        };
    }
    return result;
}

function runFights({seed = 0x12345678, iterations = 12, iterationOffset = 0, cleave = false, execution = 'sync'} = {}) {
    const api = loadSimulation(true);
    const player = createPlayer(api, cleave);
    let result;
    const sim = new api.Simulation(player, report => { result = report; }, undefined, {
        timesecsmin: 18, timesecsmax: 22, executeperc: 25, startrage: 35,
        batching: 10, iterations, seed, iterationOffset,
    });
    if (execution === 'manual') {
        for (let i = 0; i < iterations; ++i) sim.run();
        sim.finished();
    } else if (execution === 'async') {
        // Schedule yielded work immediately in this isolated, small test run.
        api.evaluate('setTimeout = callback => callback()');
        sim.startAsync();
    } else {
        sim.startSync();
    }
    assert.ok(Number.isFinite(result.totaldmg) && result.totaldmg > 0);
    result.player = snapshot(player);
    result.spread = Array.from(sim.spread, value => value || 0);
    delete result.starttime;
    delete result.endtime;
    return JSON.parse(JSON.stringify(result));
}

module.exports = {loadSimulation, createPlayer, runFights};
