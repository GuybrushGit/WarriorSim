'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Worker: NodeWorker} = require('node:worker_threads');
const ROOT = path.resolve(__dirname, '../..');

function createWorkerClass(assets) {
    return class BrowserWorker {
        static all = [];
        constructor(url) {
            this.url = url;
            this.messages = [];
            this.terminated = false;
            this.worker = new NodeWorker(path.join(__dirname, 'worker-runtime.js'), {
                workerData: {url, assets: [...assets]},
                execArgv: ['--experimental-vm-modules', '--no-warnings'],
            });
            this.worker.on('message', data => this.onmessage && this.onmessage({data}));
            this.worker.on('error', error => this.onerror && this.onerror(error));
            this.constructor.all.push(this);
        }
        postMessage(data) { this.messages.push(structuredClone(data)); this.worker.postMessage(data); }
        terminate() { this.terminated = true; return this.worker.terminate(); }
    };
}

function deployedWorkers() {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/compute-build.json')));
    const base = path.join(ROOT, 'dist');
    const url = file => pathToFileURL(path.join(base, file)).href;
    const assets = new Map(manifest.files.map(file => [url(file.path), fs.readFileSync(path.join(base, file.path))]));
    return {manifest, url, Worker: createWorkerClass(assets)};
}

function request(worker, data, local = false) {
    return new Promise((resolve, reject) => {
        worker.onerror = reject;
        worker.onmessage = ({data: result}) => {
            if (local) {
                if (result[0] === 1) resolve(result[1]);
                if (result[0] === 2) reject(new Error(result[1].message));
            } else if (result.error) reject(new Error(result.error));
            else resolve(result.report);
        };
        worker.postMessage(data);
    });
}
module.exports = {createWorkerClass, deployedWorkers, request};
