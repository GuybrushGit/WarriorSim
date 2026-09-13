'use strict';

const fs = require('node:fs');
const inspector = require('node:inspector');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {
    createConfiguredPlayer,
    createDirectReferenceEngine,
    loadFixtures,
} = require('./reference-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const requestedFixture = process.argv[2] || 'all';
const shortIterations = positiveInteger(process.argv[3] || 50000, 'short iterations');
const productionIterations = positiveInteger(process.argv[4] || 10000, 'production iterations');
const outputDirectory = process.argv[5] ? path.resolve(process.argv[5]) : null;

function positiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
        throw new Error(`${name} must be a positive safe integer`);
    return number;
}

function post(session, method, params = {}) {
    return new Promise((resolve, reject) => {
        session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
    });
}

function median(values) {
    const ordered = [...values].sort((left, right) => left - right);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function functionLabel(node) {
    const frame = node.callFrame;
    const name = frame.functionName || '(anonymous)';
    if (!frame.url) return name;
    const location = frame.lineNumber >= 0 ? `:${frame.lineNumber + 1}` : '';
    return `${name} (${frame.url}${location})`;
}

function summarize(profile, limit = 30) {
    const byId = new Map(profile.nodes.map(node => [node.id, node]));
    const selfMicros = new Map();
    for (let index = 0; index < profile.samples.length; ++index) {
        const node = byId.get(profile.samples[index]);
        if (!node) continue;
        const label = functionLabel(node);
        selfMicros.set(label, (selfMicros.get(label) || 0) + (profile.timeDeltas[index] || 0));
    }
    const durationMicros = profile.endTime - profile.startTime;
    const entries = [...selfMicros].map(([functionName, micros]) => ({
        functionName,
        selfMs: Number((micros / 1000).toFixed(3)),
        selfPercent: Number((micros / durationMicros * 100).toFixed(2)),
    })).sort((left, right) => right.selfMs - left.selfMs);
    const wasm = entries.filter(entry =>
        entry.functionName.includes('wasm://') ||
        entry.functionName.includes('wasm-function') ||
        entry.functionName.includes('warriorsim'));
    return {
        sampledDurationMs: Number((durationMicros / 1000).toFixed(3)),
        sampleIntervalMicros: median(profile.timeDeltas.filter(value => value > 0)),
        topOverall: entries.slice(0, limit),
        topWasm: wasm.slice(0, limit),
    };
}

async function loadProfilingModule() {
    const gluePath = path.join(ROOT, 'wasm', 'dist', 'warriorsim.profile.js');
    const factory = (await import(pathToFileURL(gluePath).href)).default;
    return factory();
}

function prepareSpec(fixture) {
    const engine = createDirectReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    return JSON.stringify(player.serializeSimulationSpec(fixture.sim));
}

async function profileFixture(module, fixture, iterations) {
    const specJson = prepareSpec(fixture);
    const seed = fixture.sim.seed >>> 0;
    const warmupIterations = Math.max(1, Math.min(5000, Math.ceil(iterations / 10)));
    let handle = module.createEngine(specJson, seed);
    try {
        module.runBatch(handle, warmupIterations, 0, false);
    } finally {
        module.destroyEngine(handle);
    }

    handle = module.createEngine(specJson, seed);
    const session = new inspector.Session();
    session.connect();
    let profile;
    let report;
    const started = process.hrtime.bigint();
    try {
        await post(session, 'Profiler.enable');
        await post(session, 'Profiler.setSamplingInterval', {interval: 100});
        await post(session, 'Profiler.start');
        report = JSON.parse(module.runBatch(handle, iterations, 0, false));
        ({profile} = await post(session, 'Profiler.stop'));
    } finally {
        session.disconnect();
        module.destroyEngine(handle);
    }
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const summary = {
        fixture: fixture.name,
        fightSeconds: [fixture.sim.timesecsmin, fixture.sim.timesecsmax],
        iterations,
        warmupIterations,
        elapsedMs: Number(elapsedMs.toFixed(3)),
        fightsPerSecond: Number((iterations / (elapsedMs / 1000)).toFixed(2)),
        totalDamage: report.totaldmg,
        totalDuration: report.totalduration,
        ...summarize(profile),
    };

    if (outputDirectory) {
        fs.mkdirSync(outputDirectory, {recursive: true});
        const safeName = fixture.name.replace(/[^a-z0-9_-]+/gi, '-');
        fs.writeFileSync(path.join(outputDirectory, `${safeName}.cpuprofile`), JSON.stringify(profile));
    }
    process.stdout.write(`${JSON.stringify(summary)}\n`);
}

async function main() {
    const base = loadFixtures().find(fixture => fixture.name === 'classic-dw-fury');
    if (!base) throw new Error('classic-dw-fury fixture is missing');
    const production = {
        ...base,
        name: 'classic-dw-production-90-120s',
        sim: {...base.sim, timesecsmin: 90, timesecsmax: 120},
    };
    const sod = loadFixtures().find(fixture => fixture.name === 'sod-default-twohand');
    const profiles = [
        {fixture: sod, iterations: shortIterations},
        {fixture: {...sod, name:'sod-twohand-production-90-120s', sim:{...sod.sim,timesecsmin:90,timesecsmax:120}}, iterations:productionIterations},
        {fixture: base, iterations: shortIterations},
        {fixture: production, iterations: productionIterations},
    ].filter(({fixture}) => requestedFixture === 'all' || fixture.name === requestedFixture);
    if (!profiles.length) throw new Error(`unknown profile fixture: ${requestedFixture}`);

    const module = await loadProfilingModule();
    for (const {fixture, iterations} of profiles)
        await profileFixture(module, fixture, iterations);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
