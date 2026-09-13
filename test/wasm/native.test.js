'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadFixtures, runReference} = require('./reference-engine');
const {createNativeHandle, loadNativeModule, runNative} = require('./native-engine');

const fixtures = loadFixtures();
let wasmModule;

function assertNumber(actual, expected, path) {
    assert.equal(typeof actual, 'number', `${path} must be numeric`);
    assert.ok(Number.isFinite(actual), `${path} must be finite`);
    const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-12);
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${path}: native ${actual}, JavaScript ${expected}, tolerance ${tolerance}`);
}

function assertCounts(actual, expected, path) {
    assert.deepEqual(Array.from(actual || []), Array.from(expected || []), path);
}

function compactSpread(spread) {
    return Object.fromEntries(Object.entries(spread || {})
        .filter(([, count]) => count)
        .map(([dps, count]) => [String(dps), count]));
}

function assertPlayer(actual, expected, fixtureName) {
    for (const group of ['spells', 'auras']) {
        assert.deepEqual(Object.keys(actual[group]), Object.keys(expected[group]),
            `${fixtureName} ${group} keys`);
        for (const [key, expectedAction] of Object.entries(expected[group])) {
            const actionPath = `${fixtureName} ${group}.${key}`;
            const actualAction = actual[group][key];
            assert.equal(actualAction.name, expectedAction.name, `${actionPath}.name`);
            assertNumber(actualAction.totaldmg, expectedAction.totaldmg || 0, `${actionPath}.totaldmg`);
            assertCounts(actualAction.data, expectedAction.data, `${actionPath}.data`);
            if (group === 'spells') {
                assertNumber(actualAction.cost, expectedAction.cost || 0, `${actionPath}.cost`);
                assertNumber(actualAction.totalusedrage, expectedAction.totalusedrage || 0,
                    `${actionPath}.totalusedrage`);
            } else {
                assertNumber(actualAction.uptime, expectedAction.uptime || 0, `${actionPath}.uptime`);
            }
        }
    }

    for (const hand of ['mh', 'oh']) {
        assert.equal(Boolean(actual[hand]), Boolean(expected[hand]), `${fixtureName} ${hand} presence`);
        if (!expected[hand]) continue;
        assert.equal(actual[hand].name, expected[hand].name, `${fixtureName} ${hand}.name`);
        assertNumber(actual[hand].totaldmg, expected[hand].totaldmg, `${fixtureName} ${hand}.totaldmg`);
        assertNumber(actual[hand].totalprocdmg, expected[hand].totalprocdmg,
            `${fixtureName} ${hand}.totalprocdmg`);
        assertCounts(actual[hand].data, expected[hand].data, `${fixtureName} ${hand}.data`);
    }
}

function assertExpectedNativeActivity(report, fixture) {
    for (const key of fixture.expect?.spells || []) {
        const spell = report.player.spells[key];
        assert.ok(spell, `${fixture.name} native report must include spell ${key}`);
        assert.ok(spell.totaldmg > 0, `${fixture.name} native ${key} must deal damage`);
        assert.ok(spell.data.reduce((sum, count) => sum + count, 0) > 0,
            `${fixture.name} native ${key} must record outcomes`);
    }
    for (const key of fixture.expect?.auras || []) {
        const aura = report.player.auras[key];
        assert.ok(aura, `${fixture.name} native report must include aura ${key}`);
        assert.ok(aura.uptime > 0 || aura.totaldmg > 0 ||
            aura.data.reduce((sum, count) => sum + count, 0) > 0,
        `${fixture.name} native ${key} must activate`);
    }
}

function addCounts(destination, source) {
    const length = Math.max(destination.length, source.length);
    for (let i = 0; i < length; ++i) destination[i] = (destination[i] || 0) + (source[i] || 0);
}

function mergeNativeReports(reports) {
    assert.ok(reports.length > 0);
    const merged = JSON.parse(JSON.stringify(reports[0]));
    for (const report of reports.slice(1)) {
        merged.iterations += report.iterations;
        merged.totaldmg += report.totaldmg;
        merged.totalduration += report.totalduration;
        merged.mindps = Math.min(merged.mindps, report.mindps);
        merged.maxdps = Math.max(merged.maxdps, report.maxdps);
        merged.sumdps += report.sumdps;
        merged.sumdps2 += report.sumdps2;
        for (const [dps, count] of Object.entries(report.spread))
            merged.spread[dps] = (merged.spread[dps] || 0) + count;

        for (const [key, action] of Object.entries(report.player.spells)) {
            const target = merged.player.spells[key];
            target.totaldmg += action.totaldmg;
            target.totalusedrage += action.totalusedrage;
            addCounts(target.data, action.data);
        }
        for (const [key, action] of Object.entries(report.player.auras)) {
            const target = merged.player.auras[key];
            target.totaldmg += action.totaldmg;
            target.uptime += action.uptime;
            addCounts(target.data, action.data);
        }
        for (const hand of ['mh', 'oh']) {
            if (!report.player[hand]) continue;
            const target = merged.player[hand];
            target.totaldmg += report.player[hand].totaldmg;
            target.totalprocdmg += report.player[hand].totalprocdmg;
            addCounts(target.data, report.player[hand].data);
        }
    }
    return merged;
}

function assertNativeReports(actual, expected, path) {
    assert.equal(actual.iterations, expected.iterations, `${path} iterations`);
    for (const key of [
        'totaldmg', 'totalduration', 'mindps', 'maxdps', 'sumdps', 'sumdps2',
    ]) assertNumber(actual[key], expected[key], `${path} ${key}`);
    assert.deepEqual(compactSpread(actual.spread), compactSpread(expected.spread), `${path} spread`);
    assertPlayer(actual.player, expected.player, path);
}

function runPersistentPartitions(fixture, partitions) {
    const reports = [];
    const {handle} = createNativeHandle(wasmModule, fixture);
    let offset = fixture.sim.iterationOffset || 0;
    try {
        for (const count of partitions) {
            reports.push(JSON.parse(wasmModule.runBatch(handle, count, offset, true)));
            offset += count;
        }
    } finally {
        wasmModule.destroyEngine(handle);
    }
    return reports;
}

function runFreshPartitions(fixture, partitions) {
    let offset = fixture.sim.iterationOffset || 0;
    return partitions.map(count => {
        const report = runNative(wasmModule, {
            ...fixture,
            sim: {...fixture.sim, iterations: count, iterationOffset: offset},
        });
        offset += count;
        return report;
    });
}

test.before(async () => {
    wasmModule = await loadNativeModule();
});

function assertNativeParity(fixture) {
    const expected = runReference(fixture);
    const actual = runNative(wasmModule, fixture);

    assert.equal(actual.engineVersion, 1);
    assert.equal(actual.seed, fixture.sim.seed >>> 0);
    assertNativeReports(actual, expected, fixture.name);
    assertExpectedNativeActivity(actual, fixture);
}

for (const fixture of fixtures) {
    test(`${fixture.name} native WASM matches the deterministic JavaScript engine`, () => {
        assertNativeParity(fixture);
    });
}

for (const seed of [0, 0xffffffff]) {
    for (const fixture of fixtures) {
        test(`${fixture.name} preserves parity at seed ${seed}`, () => {
            assertNativeParity({
                ...fixture,
                name: `${fixture.name} seed ${seed}`,
                sim: {...fixture.sim, seed},
            });
        });
    }
}

for (const fixture of fixtures) test(`${fixture.name}: same-handle batches and fresh-engine partitions preserve every counter`, () => {
    const partitions = [2, 7, 3, fixture.sim.iterations - 12];
    const combined = runNative(wasmModule, fixture);

    const persistentReports = runPersistentPartitions(fixture, partitions);
    assertNativeReports(mergeNativeReports(persistentReports), combined,
        'same-handle batch delta');

    const freshReports = runFreshPartitions(fixture, partitions);
    assertNativeReports(mergeNativeReports(freshReports), combined,
        'fresh-engine partition');
});

test('inactive Flurry and timed auras remain eligible across every batch boundary', () => {
    const base = fixtures.find(value => value.name === 'classic-dw-fury');
    const fixture = {...base, sim: {...base.sim, iterations: 6}};
    const partitions = [1, 2, 1, 2];
    const expected = runReference(fixture);
    const combined = runNative(wasmModule, fixture);
    assertNativeReports(combined, expected, 'inactive aura combined parity');

    const assertLifecycleActivity = (report, path) => {
        assert.ok(report.player.auras.flurry.uptime > 0,
            `${path} Flurry must activate from zero stacks`);
        assert.ok(report.player.auras.flurry.uptime < report.totalduration * 1000,
            `${path} Flurry must spend observable time inactive`);
    };
    assertLifecycleActivity(combined, 'combined');

    const persistent = runPersistentPartitions(fixture, partitions);
    persistent.forEach((report, index) => assertLifecycleActivity(report, `same-handle batch ${index}`));
    assertNativeReports(mergeNativeReports(persistent), combined,
        'inactive aura same-handle partitions');

    const fresh = runFreshPartitions(fixture, partitions);
    fresh.forEach((report, index) => assertLifecycleActivity(report, `fresh partition ${index}`));
    assertNativeReports(mergeNativeReports(fresh), combined,
        'inactive aura fresh-engine partitions');
});

test('Classic after-swing Slam and batched Windfury stay exact across event-loop partitions', () => {
    for (const fixtureName of ['classic-twohand-proc-slam', 'classic-dw-fury']) {
        const base = fixtures.find(value => value.name === fixtureName);
        const fixture = {...base, sim: {...base.sim, iterations: 6}};
        const partitions = [1, 2, 1, 2];
        const expected = runReference(fixture);
        const combined = runNative(wasmModule, fixture);
        assertNativeReports(combined, expected, `${fixtureName} event-loop parity`);

        const persistent = runPersistentPartitions(fixture, partitions);
        assertNativeReports(mergeNativeReports(persistent), combined,
            `${fixtureName} same-handle event-loop partitions`);
        const fresh = runFreshPartitions(fixture, partitions);
        assertNativeReports(mergeNativeReports(fresh), combined,
            `${fixtureName} fresh-engine event-loop partitions`);

        if (fixtureName.includes('slam')) {
            assert.ok(combined.player.spells.slam.data.reduce((sum, value) => sum + value, 0) > 0,
                'Classic after-swing Slam fixture must cast Slam');
        } else {
            assert.ok(combined.player.auras.windfury.uptime > 0,
                'batched Windfury fixture must activate Windfury');
        }
    }
});

test('compact and full native reports have identical aggregate results', () => {
    const fixture = fixtures.find(value => value.name === 'classic-dw-fury');
    const compact = runNative(wasmModule, fixture, {}, false);
    const full = runNative(wasmModule, fixture, {}, true);
    assert.equal(compact.engineVersion, full.engineVersion);
    assert.equal(compact.seed, full.seed);
    assert.equal(compact.iterations, full.iterations);
    for (const key of [
        'totaldmg', 'totalduration', 'mindps', 'maxdps', 'sumdps', 'sumdps2',
    ]) assertNumber(compact[key], full[key], `compact/full ${key}`);
    assert.equal(compact.player, undefined);
    assert.equal(compact.spread, undefined);
    assert.ok(full.player);
    assert.ok(full.spread);
});
