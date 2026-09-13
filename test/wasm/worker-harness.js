'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

// Run production worker code and its actual importScripts catalogs in a worker-like
// VM. Only the module loader is supplied by the test; the worker owns serialization,
// native handles, batch execution, report merging, progress, and cleanup.
function createWorkerHarness(nativeModule, source = false) {
    const workerPath = path.join(ROOT, source ? 'js/sim-worker.js' : 'dist/js/sim-worker.min.js');
    const messages = [];
    let context;
    context = vm.createContext({
        console, setTimeout, clearTimeout, URL,
        location: {href: 'https://example.test/WarriorSim/dist/js/sim-worker.min.js'},
        postMessage(value) { messages.push(JSON.parse(JSON.stringify(value))); },
        importScripts(...paths) {
            for (const relativePath of paths) {
                const filename = path.resolve(path.dirname(workerPath),
                    source ? relativePath.replace(/\.min\.js$/, '.js') : relativePath);
                vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
            }
        },
        __nativeModule: nativeModule,
    });
    context.self = context;
    vm.runInContext(fs.readFileSync(workerPath, 'utf8'), context, {
        filename: workerPath,
        importModuleDynamically() { throw new Error('The test supplies the native module loader'); },
    });
    vm.runInContext('loadWarriorSim = async () => globalThis.__nativeModule; globalThis.__run = run;', context);
    return {messages, run: params => context.__run(params)};
}

module.exports = {createWorkerHarness};
