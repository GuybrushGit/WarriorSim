'use strict';
// Browser worker APIs backed solely by bytes supplied when this thread starts.
// The production worker, ESM glue, and WASM execute unchanged in one VM realm.
const {parentPort, workerData} = require('node:worker_threads');
const vm = require('node:vm');
const assets = new Map(workerData.assets);
const modules = new Map();
const context = vm.createContext({
    URL, TextEncoder, TextDecoder, console, setTimeout, clearTimeout, performance,
    WorkerGlobalScope: class WorkerGlobalScope {},
    navigator: {language: 'en-US'},
    location: {href: workerData.url},
    postMessage: data => parentPort.postMessage(data),
    fetch: async url => new Response(bytes(String(url)), {
        headers: {'Content-Type': 'application/wasm'},
    }),
    importScripts(...urls) { for (const url of urls) evaluate(String(url)); },
});
context.self = context;

function bytes(url) {
    if (!assets.has(url)) throw new Error(`Worker requested an asset that was not retained: ${url}`);
    return assets.get(url);
}
async function importModule(url) {
    if (!modules.has(url)) {
        const module = new vm.SourceTextModule(Buffer.from(bytes(url)).toString(), {
            context, identifier: url,
            initializeImportMeta(meta) { meta.url = url; },
            importModuleDynamically: importModule,
        });
        modules.set(url, module);
        await module.link(specifier => importModule(new URL(specifier, url).href));
        await module.evaluate();
    }
    return modules.get(url);
}
function evaluate(url) {
    vm.runInContext(Buffer.from(bytes(url)).toString(), context, {
        filename: url, importModuleDynamically: importModule,
    });
}
evaluate(workerData.url);
parentPort.on('message', data => context.onmessage({data}));
