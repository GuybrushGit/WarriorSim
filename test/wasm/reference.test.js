'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {comparableReport, createConfiguredPlayer, createReferenceEngine, loadFixtures, runReference, runPartitioned} = require('./reference-engine');
const fixtures = loadFixtures();
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-reports.json')));
function close(actual, expected, key = 'report') {
    if (typeof expected === 'number') {
        assert.ok(Number.isFinite(actual), `${key} finite`);
        assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected)*1e-12), `${key}: ${actual} != ${expected}`);
    } else if (expected && typeof expected === 'object') {
        assert.deepEqual(Object.keys(actual), Object.keys(expected), `${key} keys`);
        for (const name of Object.keys(expected)) close(actual[name], expected[name], `${key}.${name}`);
    } else assert.equal(actual, expected, key);
}
for (const fixture of fixtures) {
    test(`${fixture.name}: deterministic complete JavaScript golden`, () => {
        assert.deepEqual(comparableReport(runReference(fixture)), golden.reports[fixture.name]);
        assert.deepEqual(comparableReport(runReference(fixture)), golden.reports[fixture.name]);
    });
    test(`${fixture.name}: fresh uneven JavaScript partitions`, () => {
        close(comparableReport(runPartitioned(fixture, [2,7,3,fixture.sim.iterations-12])), golden.reports[fixture.name]);
    });
    test(`${fixture.name}: serializable initialized execution graph`, () => {
        const engine = createReferenceEngine(fixture.mode);
        const player = createConfiguredPlayer(engine, fixture);
        const spec = player.serializeSimulationSpec(fixture.sim);
        const parsed = JSON.parse(JSON.stringify(spec));
        assert.equal(parsed.player.props.mode, fixture.mode);
        assert.ok(parsed.player.weapons.mh);
        assert.equal(parsed.sim.seed, fixture.sim.seed);
        assert.ok(parsed.player.spells.length > 0);
        const kinds = parsed.player.auras.map(x => x.kind);
        assert.ok(!kinds.includes('Hategrips'));
        for (const key of fixture.expect?.spells || []) {
            assert.ok(golden.reports[fixture.name].player.spells[key].totaldmg > 0, `${key} must activate`);
        }
        for (const key of fixture.expect?.auras || []) {
            const aura = golden.reports[fixture.name].player.auras[key];
            assert.ok(aura && (aura.uptime > 0 || aura.totaldmg > 0), `${key} must activate`);
        }
    });
}
module.exports = {close};
