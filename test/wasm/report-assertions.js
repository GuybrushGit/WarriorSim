'use strict';

const assert = require('node:assert/strict');




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




function assertNativeReports(actual, expected, path) {
    assert.equal(actual.iterations, expected.iterations, `${path} iterations`);
    for (const key of [
        'totaldmg', 'totalduration', 'mindps', 'maxdps', 'sumdps', 'sumdps2',
    ]) assertNumber(actual[key], expected[key], `${path} ${key}`);
    assert.deepEqual(compactSpread(actual.spread), compactSpread(expected.spread), `${path} spread`);
    assertPlayer(actual.player, expected.player, path);
}


module.exports={assertNativeReports,assertPlayer,assertNumber};
