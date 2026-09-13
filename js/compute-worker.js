/* Persistent WASM instance for bounded, deterministic chunks. */
const computeAssetUrl = file => globalThis.SIMULATOR_BUNDLE ?
    globalThis.SIMULATOR_BUNDLE.url(file) : new URL('../' + file, self.location.href).href;
const computeModuleUrl = computeAssetUrl('wasm/warriorsim.js');
let computeModulePromise, computeEngine, computeIdentity, computeBusy = false;
onmessage = async ({data}) => {
    if (computeBusy) return;
    computeBusy = true;
    try {
        if (!computeModulePromise) {
            computeModulePromise = import(computeModuleUrl).then(exports => exports.default({
                locateFile: file => computeAssetUrl('wasm/' + file),
            }));
        }
        const module = await computeModulePromise;
        // Job IDs can be reused by different owners. Match the actual configuration
        // and seed before retaining an engine between bounded chunks.
        const spec = JSON.stringify(data.spec);
        const identity = JSON.stringify([data.jobId, data.seed, spec]);
        if (computeIdentity !== identity) {
            if (computeEngine !== undefined) module.destroyEngine(computeEngine);
            computeEngine = undefined;
            computeIdentity = undefined;
            computeEngine = module.createEngine(spec, data.seed);
            computeIdentity = identity;
        }
        const report = JSON.parse(module.runBatch(computeEngine, data.count, data.offset, data.fullReport));
        postMessage({id: data.id, report});
    } catch (error) {
        postMessage({id: data.id, error: String(error && error.message || error)});
    } finally {
        computeBusy = false;
    }
};
