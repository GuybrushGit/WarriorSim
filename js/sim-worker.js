importScripts(
    './data/levelstats.min.js',
    './data/buffs.min.js',
    './data/enchants.min.js',
    './data/spells.min.js',
    './data/talents.min.js',
    './classes/player.min.js',
    './classes/simulation.min.js',
    './classes/spell.min.js',
    './classes/weapon.min.js',
    './globals.min.js',
);

const WASM_MODULE_URL = new URL('../wasm/warriorsim.js', self.location.href).href;
const DEFAULT_BATCH_SIZE = 500;
const WORKER_MAX_SIMULATION_UINT32 = 0xFFFFFFFF;
const WORKER_SIMULATION_ITERATION_DOMAIN = 0x100000000;

let modulePromise;
let activeRun = false;
let cancelled = false;

function loadWarriorSim() {
    if (!modulePromise) {
        modulePromise = import(WASM_MODULE_URL).then((exports) => {
            const factory = exports.default || exports.createWarriorSim;
            if (typeof factory !== 'function') {
                throw new Error('The WarriorSim WASM module does not export createWarriorSim');
            }
            return factory({
                locateFile: (file) => new URL(file, WASM_MODULE_URL).href,
            });
        });
    }
    return modulePromise;
}

function importRules(sod) {
    if (sod) importScripts('./data/gear_sod.min.js', './data/runes.min.js');
    else importScripts('./data/gear.min.js');
}

function parseReport(value) {
    const report = typeof value === 'string' ? JSON.parse(value) : value;
    if (!report || typeof report !== 'object' || !Number.isFinite(report.iterations)) {
        throw new Error('The WarriorSim WASM module returned an invalid report');
    }
    return report;
}

function errorPayload(error) {
    const stringify = (value) => {
        if (Array.isArray(value)) return value.map(stringify).filter(Boolean).join(': ');
        if (value && typeof value === 'object') {
            if (value.what) return stringify(value.what);
            try { return JSON.stringify(value); }
            catch (_) { return String(value); }
        }
        return value == null ? '' : String(value);
    };
    if (error && typeof error === 'object') {
        return {
            name: stringify(error.name) || 'Error',
            message: stringify(error.message || error),
            stack: error.stack || '',
        };
    }
    return { name: 'Error', message: stringify(error), stack: '' };
}

function nextTask() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function run(params) {
    if (activeRun) throw new Error('This simulation worker is already running');
    activeRun = true;
    cancelled = false;

    let engine;
    let module;
    const started = Date.now();

    try {
        if (!params || !params.sim || !params.globals || !Array.isArray(params.player)) {
            throw new Error('Simulation configuration, globals, and player arguments are required');
        }
        if (!Number.isSafeInteger(params.sim.seed) || params.sim.seed < 0 ||
            params.sim.seed > WORKER_MAX_SIMULATION_UINT32) {
            throw new Error('Simulation seed must be an unsigned 32-bit integer');
        }
        importRules(params.globals.sod);
        updateGlobals(params.globals);

        const player = new Player(...params.player);
        if (!player.mh) throw new Error('No weapon selected');
        if (typeof player.serializeSimulationSpec !== 'function') {
            throw new Error('Player.serializeSimulationSpec is unavailable; rebuild the JavaScript assets');
        }

        if (!Number.isSafeInteger(params.sim.iterations) || params.sim.iterations <= 0 ||
            params.sim.iterations > WORKER_MAX_SIMULATION_UINT32) {
            throw new Error('Simulation iterations must be a positive unsigned 32-bit integer');
        }
        if (params.batchSize !== undefined &&
            (!Number.isSafeInteger(params.batchSize) || params.batchSize <= 0 ||
                params.batchSize > WORKER_MAX_SIMULATION_UINT32)) {
            throw new Error('Simulation batch size must be a positive unsigned 32-bit integer');
        }
        if (!Number.isSafeInteger(params.sim.iterationOffset) || params.sim.iterationOffset < 0 ||
            params.sim.iterationOffset > WORKER_MAX_SIMULATION_UINT32) {
            throw new Error('Simulation iteration offset must be an unsigned 32-bit integer');
        }
        if (params.sim.iterationOffset + params.sim.iterations > WORKER_SIMULATION_ITERATION_DOMAIN) {
            throw new Error('Simulation iteration range exceeds the unsigned 32-bit seed domain');
        }
        const iterations = params.sim.iterations;
        const batchSize = params.batchSize || DEFAULT_BATCH_SIZE;
        const seed = Number(params.sim.seed) >>> 0;
        const iterationOffset = params.sim.iterationOffset;
        const spec = player.serializeSimulationSpec(params.sim);
        module = await loadWarriorSim();
        for (const method of ['createEngine', 'runBatch', 'destroyEngine']) {
            if (typeof module[method] !== 'function') {
                throw new Error(`The WarriorSim WASM module is missing ${method}; rebuild the distribution assets`);
            }
        }
        if (cancelled) return;
        engine = module.createEngine(JSON.stringify(spec), seed);

        let completed = 0;
        let report;
        while (completed < iterations) {
            if (cancelled) return;

            const count = Math.min(batchSize, iterations - completed);
            const delta = parseReport(module.runBatch(
                engine,
                count,
                iterationOffset + completed,
                Boolean(params.fullReport),
            ));
            report = mergeSimulationReports(report, delta);
            completed += count;
            report.iterations = completed;

            if (completed < iterations) {
                postMessage([TYPE.UPDATE, completed, {
                    iterations,
                    totaldmg: report.totaldmg,
                    totalduration: report.totalduration,
                }]);
                await nextTask();
            }
        }

        if (!report) throw new Error('Simulation iterations must be greater than zero');
        report.starttime = started;
        report.endtime = Date.now();
        postMessage([TYPE.FINISHED, report]);
    } finally {
        if (module && engine !== undefined) module.destroyEngine(engine);
        activeRun = false;
    }
}

onmessage = (event) => {
    if (event.data && event.data.type === 'cancel') {
        cancelled = true;
        return;
    }
    run(event.data).catch((error) => {
        postMessage([TYPE.ERROR, errorPayload(error)]);
    });
};
