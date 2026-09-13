'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

const MODE_SOURCES = {
 classic: ['js/data/gear.js','js/data/enchants.js','js/data/talents.js','js/data/spells.js','js/data/buffs.js','js/data/session.js'],
 sod: ['js/data/gear_sod.js','js/data/enchants.js','js/data/talents.js','js/data/spells.js','js/data/buffs.js','js/data/runes.js','js/data/session_sod.js'],
};

const ENGINE_SOURCES = [
    'js/data/levelstats.js',
    'js/classes/player.js',
    'js/classes/simulation.js',
    'js/classes/spell.js',
    'js/classes/weapon.js',
    'js/globals.js',
];

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function jqueryStub() {
    return {
        addClass() { return this; },
        click() { return this; },
        prop() { return false; },
        removeClass() { return this; },
        text() { return this; },
        val() { return undefined; },
    };
}

function loadSource(context, relativePath) {
    const filename = path.join(ROOT, relativePath);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function createReferenceEngine(mode, options = {}) {
    const modeSources = MODE_SOURCES[mode];
    if (!modeSources) throw new Error(`Unsupported reference mode: ${mode}`);

    const context = vm.createContext({
        console: options.console || console,
        setTimeout,
        clearTimeout,
        window: { location: { href: mode === 'sod' ? 'index.html' : 'classic.html' } },
        $: jqueryStub,
        mode,
    });

    for (const source of [...modeSources, ...ENGINE_SOURCES]) loadSource(context, source);
    vm.runInContext(`
        globalThis.__referenceEngine = {
            configure(state) {
                updateGlobals(state);
            },
            createPlayer(config) {
                return new Player(undefined, undefined, undefined, config);
            },
            createAura(player, kind, id) {
                const constructors = { CoinFlip, EchoesBattle, EchoesZerk, Flurry, Spicy };
                if (!constructors[kind]) throw new Error('Unsupported synthetic aura kind: ' + kind);
                return new constructors[kind](player, id);
            },
            createSpell(player, kind, id) {
                const constructors = { GrilekFury };
                if (!constructors[kind]) throw new Error('Unsupported synthetic spell kind: ' + kind);
                return new constructors[kind](player, id);
            },
            createSimulation(player, config) {
                return new Simulation(player, undefined, undefined, config);
            },
            defaultState() {
                return JSON.parse(JSON.stringify(session));
            },
            serialize(player) {
                const serializeAction = action => ({
                    name: action.name,
                    uptime: action.uptime || 0,
                    totaldmg: action.totaldmg || 0,
                    totalusedrage: action.totalusedrage || 0,
                    cost: action.cost || 0,
                    data: action.data ? Array.from(action.data) : undefined,
                });
                const serializeGroup = group => Object.fromEntries(
                    Object.entries(group).map(([name, action]) => [name, serializeAction(action)])
                );
                const serializeWeapon = weapon => weapon ? {
                    name: weapon.name,
                    totaldmg: weapon.totaldmg || 0,
                    totalprocdmg: weapon.totalprocdmg || 0,
                    data: Array.from(weapon.data),
                } : undefined;
                return {
                    auras: serializeGroup(player.auras),
                    spells: serializeGroup(player.spells),
                    mh: serializeWeapon(player.mh),
                    oh: serializeWeapon(player.oh),
                };
            },
            rngSequence(seed, count) {
                setSimulationSeed(seed);
                const values = [];
                for (let i = 0; i < count; ++i) values.push(simulationRandom());
                return values;
            },
            iterationSeed(baseSeed, iteration) {
                return simulationIterationSeed(baseSeed, iteration);
            },
        };
    `, context);

    return context.__referenceEngine;
}

function createDirectReferenceEngine(mode, options = {}) {
    const modeSources = MODE_SOURCES[mode];
    if (!modeSources) throw new Error(`Unsupported reference mode: ${mode}`);
    const source = [...modeSources, ...ENGINE_SOURCES]
        .map(relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
        .join('\n');
    const create = new Function('console', 'setTimeout', 'clearTimeout', 'window', '$', 'mode', `
        ${source}
        return {
            configure(state) { updateGlobals(state); },
            createPlayer(config) { return new Player(undefined, undefined, undefined, config); },
            createAura(player, kind, id) {
                const constructors = { CoinFlip, EchoesBattle, EchoesZerk, Flurry, Spicy };
                if (!constructors[kind]) throw new Error('Unsupported synthetic aura kind: ' + kind);
                return new constructors[kind](player, id);
            },
            createSpell(player, kind, id) {
                const constructors = { GrilekFury };
                if (!constructors[kind]) throw new Error('Unsupported synthetic spell kind: ' + kind);
                return new constructors[kind](player, id);
            },
            createSimulation(player, config) { return new Simulation(player, undefined, undefined, config); },
            defaultState() { return JSON.parse(JSON.stringify(session)); },
            serialize(player) {
                const serializeAction = action => ({
                    name: action.name,
                    uptime: action.uptime || 0,
                    totaldmg: action.totaldmg || 0,
                    totalusedrage: action.totalusedrage || 0,
                    cost: action.cost || 0,
                    data: action.data ? Array.from(action.data) : undefined,
                });
                const serializeGroup = group => Object.fromEntries(
                    Object.entries(group).map(([name, action]) => [name, serializeAction(action)])
                );
                const serializeWeapon = weapon => weapon ? {
                    name: weapon.name,
                    totaldmg: weapon.totaldmg || 0,
                    totalprocdmg: weapon.totalprocdmg || 0,
                    data: Array.from(weapon.data),
                } : undefined;
                return {
                    auras: serializeGroup(player.auras),
                    spells: serializeGroup(player.spells),
                    mh: serializeWeapon(player.mh),
                    oh: serializeWeapon(player.oh),
                };
            },
        };
    `);
    return create(
        options.console || console,
        setTimeout,
        clearTimeout,
        {location: {href: mode === 'sod' ? 'index.html' : 'classic.html'}},
        jqueryStub,
        mode,
    );
}

function createState(engine, fixture) {
    const state = clone(engine.defaultState());

    for (const [slot, ids] of Object.entries(fixture.gear || {})) {
        state.gear[slot] = ids.map(id => ({ id, selected: true }));
    }
    for (const [slot, ids] of Object.entries(fixture.enchant || {})) {
        state.enchant[slot] = ids.map(id => ({ id, selected: true }));
    }

    const rotation = new Map(state.rotation.map(spell => [String(spell.id), spell]));
    for (const [id, changes] of Object.entries(fixture.rotation || {})) {
        const spell = rotation.get(id);
        if (spell) Object.assign(spell, changes);
        else state.rotation.push({ id: Number(id), ...changes });
    }

    if (fixture.runes) state.runes = Object.fromEntries(Object.entries(fixture.runes).map(([slot, ids]) => [slot, ids.map(id => ({id, selected: true}))]));
    if (fixture.buffs) state.buffs = fixture.buffs;
    if (fixture.buffsRemove) {
        const removed = new Set(fixture.buffsRemove.map(String));
        state.buffs = state.buffs.filter(id => id == null || !removed.has(String(id)));
    }
    if (fixture.buffsAdd) {
        const selected = new Set(state.buffs.filter(id => id != null).map(String));
        for (const id of fixture.buffsAdd) {
            if (!selected.has(String(id))) state.buffs.push(String(id));
        }
    }
    if (fixture.talents) state.talents = fixture.talents.map(t => ({ t }));

    return {
        talents: state.talents,
        buffs: state.buffs,
        rotation: state.rotation,
        gear: state.gear,
        enchant: state.enchant,
        runes: state.runes || {},
        resistances: state.resistances || state.resistance || {},
    };
}

function createConfiguredPlayer(engine, fixture, logging = false) {
    engine.configure(createState(engine, fixture));
    const config = clone(fixture.player);
    config.mode = fixture.mode;
    config.logging = logging;
    const player = engine.createPlayer(config);
    if (fixture.playerOverrides) Object.assign(player, clone(fixture.playerOverrides));
    for (const [hand, overrides] of Object.entries(fixture.weaponOverrides || {})) Object.assign(player[hand], clone(overrides));
    if (fixture.mutatePlayer) fixture.mutatePlayer(player, engine);
    if (!player.mh) throw new Error(`${fixture.name} did not create a main-hand weapon`);
    return player;
}

function reportFromSimulation(engine, simulation, player, elapsedMs) {
    return clone({
        iterations: simulation.completedIterations,
        totaldmg: simulation.totaldmg,
        totalduration: simulation.totalduration,
        mindps: simulation.mindps,
        maxdps: simulation.maxdps,
        sumdps: simulation.sumdps,
        sumdps2: simulation.sumdps2,
        spread: simulation.spread,
        player: engine.serialize(player),
        elapsedMs,
    });
}

function runReference(fixture, options = {}) {
    const engine = options.engine || createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    const simConfig = { ...clone(fixture.sim), ...options.sim };
    const simulation = engine.createSimulation(player, simConfig);
    const started = process.hrtime.bigint();
    simulation.startSync();
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    return reportFromSimulation(engine, simulation, player, elapsedMs);
}

function runFightSequence(fixture) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    const simulation = engine.createSimulation(player, clone(fixture.sim));
    const fights = [];
    for (let i = 0; i < fixture.sim.iterations; ++i) {
        const damageBefore = simulation.totaldmg;
        const durationBefore = simulation.totalduration;
        simulation.run(i);
        fights.push({
            globalIteration: (fixture.sim.iterationOffset || 0) + i,
            damage: simulation.totaldmg - damageBefore,
            duration: simulation.totalduration - durationBefore,
        });
    }
    return fights;
}

function traceFirstFight(fixture) {
    const lines = [];
    const capture = (value) => {
        const line = String(value);
        if (line.includes(' | ')) lines.push(line);
    };
    const engine = createReferenceEngine(fixture.mode, {
        console: { log: capture, warn: capture, error: capture },
    });
    const player = createConfiguredPlayer(engine, fixture, true);
    const simulation = engine.createSimulation(player, { ...clone(fixture.sim), iterations: 1 });
    simulation.startSync();
    return {
        lines,
        report: reportFromSimulation(engine, simulation, player, 0),
    };
}

function traceAuraLifecycle(fixture, auraKeys) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    let simulation;
    const initial = {};
    const events = [];
    const snapshot = aura => ({timer: aura.timer, stacks: aura.stacks, uptime: aura.uptime});
    for (const key of auraKeys) {
        const aura = player.auras[key];
        if (!aura) throw new Error(`${fixture.name} did not create aura ${key}`);
        initial[key] = snapshot(aura);
        for (const method of ['use', 'proc', 'step']) {
            if (typeof aura[method] !== 'function') continue;
            const original = aura[method];
            aura[method] = function(...args) {
                const before = snapshot(this);
                const result = original.apply(this, args);
                events.push({
                    key,
                    method,
                    iteration: simulation.completedIterations,
                    before,
                    after: snapshot(this),
                });
                return result;
            };
        }
    }
    simulation = engine.createSimulation(player, clone(fixture.sim));
    simulation.startSync();
    return {
        initial,
        events,
        report: reportFromSimulation(engine, simulation, player, 0),
    };
}

function addArrays(destination, source) {
    for (const [key, count] of Object.entries(source || {})) {
        if (count != null) destination[key] = (destination[key] || 0) + count;
    }
}

function mergePlayerStats(destination, source) {
    for (const group of ['auras', 'spells']) {
        for (const [id, value] of Object.entries(source[group] || {})) {
            if (!destination[group][id]) {
                destination[group][id] = clone(value);
                continue;
            }
            const target = destination[group][id];
            if (value.uptime != null) target.uptime += value.uptime;
            if (value.totaldmg != null) target.totaldmg = (target.totaldmg || 0) + value.totaldmg;
            if (value.totalusedrage != null) target.totalusedrage = (target.totalusedrage || 0) + value.totalusedrage;
            if (value.data) addArrays(target.data, value.data);
        }
    }
    for (const hand of ['mh', 'oh']) {
        if (!source[hand]) continue;
        if (!destination[hand]) {
            destination[hand] = clone(source[hand]);
            continue;
        }
        destination[hand].totaldmg += source[hand].totaldmg;
        destination[hand].totalprocdmg += source[hand].totalprocdmg;
        addArrays(destination[hand].data, source[hand].data);
    }
}

function mergeReports(reports) {
    if (!reports.length) throw new Error('Cannot merge an empty report list');
    const merged = clone(reports[0]);
    merged.elapsedMs = reports.reduce((sum, report) => sum + report.elapsedMs, 0);
    for (const report of reports.slice(1)) {
        merged.iterations += report.iterations;
        merged.totaldmg += report.totaldmg;
        merged.totalduration += report.totalduration;
        merged.mindps = Math.min(merged.mindps, report.mindps);
        merged.maxdps = Math.max(merged.maxdps, report.maxdps);
        merged.sumdps += report.sumdps;
        merged.sumdps2 += report.sumdps2;
        addArrays(merged.spread, report.spread);
        mergePlayerStats(merged.player, report.player);
    }
    return merged;
}

function runPartitioned(fixture, partitions) {
    const reports = [];
    let offset = fixture.sim.iterationOffset || 0;
    for (const iterations of partitions) {
        reports.push(runReference(fixture, {
            sim: { iterations, iterationOffset: offset },
        }));
        offset += iterations;
    }
    return mergeReports(reports);
}

function comparableReport(report) {
    const copy = clone(report);
    delete copy.elapsedMs;
    copy.spread = Object.fromEntries(Object.entries(copy.spread || {}).filter(([, count]) => count));
    return copy;
}

function loadFixtures() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));
}

module.exports = {
    createState,
    comparableReport,
    createConfiguredPlayer,
    createDirectReferenceEngine,
    createReferenceEngine,
    loadFixtures,
    mergeReports,
    runFightSequence,
    runPartitioned,
    runReference,
    traceAuraLifecycle,
    traceFirstFight,
};
