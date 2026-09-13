'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../../js/compute-protocol');
const BUILD = 'a'.repeat(64);
const ROOT = path.resolve(__dirname, '../..');
const spec = () => ({version: 1, sim: {timesecsmin: 10, timesecsmax: 10},
    player: {weapons: {mh: {props: {name: 'Test weapon'}}, oh: null}, spells: [], auras: []}});
const job = (id = 'job', overrides = {}) => ({id, spec: spec(), seed: 42, iterations: 640,
    offset: 13, chunkSize: 128, fullReport: false, ...overrides});
function report(job, index) {
    const {count} = P.range(job, index);
    return {iterations: count, totaldmg: count * 100, totalduration: count * 10,
        sumdps: count * 10, sumdps2: count * 100, mindps: 10, maxdps: 10,
        seed: job.seed, engineVersion: 1, starttime: 0, endtime: 0};
}
function harness(overrides = {}) {
    class FakeWorker {
        static all = [];
        constructor(url) { this.url = url; this.messages = []; this.terminated = false; FakeWorker.all.push(this); }
        postMessage(value) { this.messages.push(value); }
        terminate() { this.terminated = true; }
        finish() {
            const data = this.messages.at(-1);
            this.onmessage({data: {id: data.id, report: report(job('job', {iterations: data.count, offset: data.offset, seed: data.seed}), 0)}});
        }
    }
    class FakeSocket {
        static all = [];
        constructor() { this.readyState = 0; this.bufferedAmount = 0; this.messages = []; FakeSocket.all.push(this); }
        send(value) { this.messages.push(JSON.parse(value)); }
        close() { this.readyState = 3; if (this.onclose) this.onclose({code: 1008}); }
        open() { this.readyState = 1; this.onopen(); this.deliver({type: 'ready', protocol: P.version, buildId: BUILD}); }
        deliver(message) { this.onmessage({data: JSON.stringify({buildId: BUILD, ...message})}); }
    }
    const context = vm.createContext({console, setTimeout, clearTimeout, URL, crypto: require('node:crypto').webcrypto,
        ComputeProtocol: P, Worker: FakeWorker, WebSocket: FakeSocket,
        Player: class {constructor() { this.mh = {}; } serializeSimulationSpec() { return spec(); }}, ...overrides});
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/classes/simulation.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/shared-compute.js'), 'utf8') +
        '\n;globalThis.api = {SharedComputeClient, SharedSimulation, mergeSimulationReports, createSimulationRunner,' +
        ' setClient(value) { sharedCompute = value; }};', context);
    return {api: context.api, FakeWorker, FakeSocket};
}
const params = () => ({player: [], sim: {iterations: 640, seed: 42, iterationOffset: 13}, fullReport: false});
module.exports = {ROOT, BUILD, P, job, report, spec, harness, params};
