'use strict';

const {
    createConfiguredPlayer,
    createDirectReferenceEngine,
    loadFixtures,
} = require('./reference-engine');
const {createNativeHandleFromSpec, loadNativeModule} = require('./native-engine');

const requestedIterations = Number(process.argv[2] || 1000);
const warmupIterations = Number(process.argv[3] || Math.min(250, requestedIterations));
const rounds = Number(process.argv[4] || 5);
if (!Number.isInteger(requestedIterations) || requestedIterations < 1 ||
    !Number.isInteger(warmupIterations) || warmupIterations < 1 ||
    !Number.isInteger(rounds) || rounds < 1) {
    throw new Error('Measured iterations, warmup iterations, and rounds must be positive integers');
}

const benchmarkNames = new Set([
    'classic-dw-fury',
    'sod-default-twohand',
    'sod-twohand-runes',
    'classic-adjacent-cleave',
    'classic-twohand-proc-slam',
]);

function milliseconds(started) {
    return Number(process.hrtime.bigint() - started) / 1e6;
}

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function prepareJavaScript(engine, fixture, iterations) {
    const player = createConfiguredPlayer(engine, fixture);
    const simulation = engine.createSimulation(player, {
        ...fixture.sim,
        iterations,
        iterationOffset: 0,
    });
    return {player, simulation};
}

function runJavaScript(engine, fixture, iterations) {
    const setupStarted = process.hrtime.bigint();
    const {simulation} = prepareJavaScript(engine, fixture, iterations);
    const setupMs = milliseconds(setupStarted);
    const runStarted = process.hrtime.bigint();
    simulation.startSync();
    return {
        setupMs,
        elapsedMs: milliseconds(runStarted),
        totaldmg: simulation.totaldmg,
        totalduration: simulation.totalduration,
    };
}

function runWasm(module, specJson, fixture, iterations) {
    const setupStarted = process.hrtime.bigint();
    const handle = createNativeHandleFromSpec(module, specJson, fixture.sim.seed);
    const setupMs = milliseconds(setupStarted);
    try {
        const runStarted = process.hrtime.bigint();
        const report = JSON.parse(module.runBatch(handle, iterations, 0, false));
        return {...report, setupMs, elapsedMs: milliseconds(runStarted)};
    } finally {
        module.destroyEngine(handle);
    }
}

function assertParity(fixture, wasm, javascript) {
    for (const [engine, report] of [['WASM', wasm], ['JavaScript', javascript]]) {
        if (!Number.isFinite(report.totaldmg) || !Number.isFinite(report.totalduration) ||
            report.totalduration <= 0) {
            throw new Error(`${fixture.name} ${engine} benchmark returned invalid totals`);
        }
    }
    const damageTolerance = Math.max(1e-9, Math.abs(javascript.totaldmg) * 1e-12);
    const durationTolerance = Math.max(1e-9, Math.abs(javascript.totalduration) * 1e-12);
    if (Math.abs(wasm.totaldmg - javascript.totaldmg) > damageTolerance ||
        Math.abs(wasm.totalduration - javascript.totalduration) > durationTolerance) {
        throw new Error(`${fixture.name} benchmark parity failed: native ${wasm.totaldmg}, JS ${javascript.totaldmg}`);
    }
}

async function main() {
    let started = process.hrtime.bigint();
    const wasmModule = await loadNativeModule();
    const wasmModuleLoadMs = milliseconds(started);
    process.stdout.write(`${JSON.stringify({
        phase: 'module-load',
        engine: 'wasm-release',
        elapsedMs: Number(wasmModuleLoadMs.toFixed(3)),
    })}\n`);

    const shipped = loadFixtures().filter(value => benchmarkNames.has(value.name));
    const productionBase = shipped.find(value => value.name === 'classic-dw-fury');
    const sodBase = shipped.find(value => value.name === 'sod-default-twohand');
    const fixtures = [...shipped, {
        ...sodBase,
        name: 'sod-twohand-production-90-120s',
        sim: {...sodBase.sim, timesecsmin: 90, timesecsmax: 120},
    }, {
        ...productionBase,
        name: 'classic-dw-production-90-120s',
        sim: {...productionBase.sim, timesecsmin: 90, timesecsmax: 120},
    }];

    for (const fixture of fixtures) {
        started = process.hrtime.bigint();
        const directEngine = createDirectReferenceEngine(fixture.mode);
        const javascriptSourceLoadMs = milliseconds(started);

        started = process.hrtime.bigint();
        const resolved = prepareJavaScript(directEngine, fixture, requestedIterations).player;
        const specJson = JSON.stringify(resolved.serializeSimulationSpec({
            ...fixture.sim,
            iterations: requestedIterations,
        }));
        const resolvedPlayerAndSpecMs = milliseconds(started);

        const warmJavaScript = runJavaScript(directEngine, fixture, warmupIterations);
        const warmWasm = runWasm(wasmModule, specJson, fixture, warmupIterations);
        assertParity(fixture, warmWasm, warmJavaScript);

        const javascriptRounds = [];
        const wasmRounds = [];
        for (let round = 0; round < rounds; ++round) {
            let javascript;
            let wasm;
            if (round % 2) {
                wasm = runWasm(wasmModule, specJson, fixture, requestedIterations);
                javascript = runJavaScript(directEngine, fixture, requestedIterations);
            } else {
                javascript = runJavaScript(directEngine, fixture, requestedIterations);
                wasm = runWasm(wasmModule, specJson, fixture, requestedIterations);
            }
            assertParity(fixture, wasm, javascript);
            javascriptRounds.push(javascript);
            wasmRounds.push(wasm);
        }

        const javascriptElapsedMs = median(javascriptRounds.map(value => value.elapsedMs));
        const wasmElapsedMs = median(wasmRounds.map(value => value.elapsedMs));
        const javascriptFightsPerSecond = requestedIterations / (javascriptElapsedMs / 1000);
        const wasmFightsPerSecond = requestedIterations / (wasmElapsedMs / 1000);
        process.stdout.write(`${JSON.stringify({
            phase: 'warm-simulation',
            fixture: fixture.name,
            fightSeconds: [fixture.sim.timesecsmin, fixture.sim.timesecsmax],
            iterations: requestedIterations,
            warmupIterations,
            rounds,
            oneTimeSetup: {
                wasmModuleLoadMs: Number(wasmModuleLoadMs.toFixed(3)),
                javascriptSourceLoadMs: Number(javascriptSourceLoadMs.toFixed(3)),
                resolvedPlayerAndSpecMs: Number(resolvedPlayerAndSpecMs.toFixed(3)),
            },
            javascript: {
                loader: 'direct-function-unminified',
                medianSimulationSetupMs: Number(median(javascriptRounds.map(value => value.setupMs)).toFixed(3)),
                medianElapsedMs: Number(javascriptElapsedMs.toFixed(3)),
                fightsPerSecond: Number(javascriptFightsPerSecond.toFixed(2)),
            },
            wasm: {
                configuration: 'Release',
                medianNativeEngineSetupMs: Number(median(wasmRounds.map(value => value.setupMs)).toFixed(3)),
                medianElapsedMs: Number(wasmElapsedMs.toFixed(3)),
                fightsPerSecond: Number(wasmFightsPerSecond.toFixed(2)),
            },
            speedup: Number((wasmFightsPerSecond / javascriptFightsPerSecond).toFixed(3)),
            totalDamage: wasmRounds[0].totaldmg,
            totalDuration: wasmRounds[0].totalduration,
            seed: fixture.sim.seed >>> 0,
        })}\n`);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
