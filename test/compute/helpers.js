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
            this.onmessage({data: {id: data.id, report: report(job('job', {iterations: data.count, chunkSize: data.count,
                offset: data.offset, seed: data.seed}), 0)}});
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
        ' initSharedCompute, sharedComputeLocalThreads,' +
        ' getClient() { return sharedCompute; }, setClient(value) { sharedCompute = value; }};', context);
    return {api: context.api, FakeWorker, FakeSocket};
}

// Just enough DOM for the sharing panel: the toggle, the status line, and the three
// thread entries with their sliders. querySelectorAll ignores its argument; the panel
// uses one selector. Each entry answers only the two selectors the panel asks it for.
function dom({stored = null, localThreads = null, sharedThreads = null, hardwareConcurrency = 8} = {}) {
    const listeners = {};
    const element = (extra = {}) => {
        const node = {textContent: '', children: [], classes: new Set(), dataset: {}, ...extra};
        node.classList = {toggle: (name, on) => { if (on) node.classes.add(name); else node.classes.delete(name); }};
        Object.defineProperty(node, 'lastElementChild', {get: () => node.children.at(-1) || null});
        return node;
    };
    const control = () => {
        const input = element({min: '', max: '', value: '', disabled: false,
            addEventListener(type, fn) { input[`on${type}`] = fn; }});
        return input;
    };
    const entry = (name, sliding) => {
        const cell = element({textContent: '—'});
        const row = element({children: [element(), cell]});
        const input = sliding ? control() : null;
        const node = element({dataset: {threads: name}, children: input ? [row, input] : [row]});
        node.querySelector = selector => selector === '.share-compute-row' ? row :
            selector === 'input[type="range"]' ? input : null;
        return {node, cell, input};
    };
    const entries = {local: entry('local', true), network: entry('network', false), shared: entry('shared', true)};
    for (const name of ['network', 'shared']) entries[name].node.classes.add('share-compute-idle');
    const toggle = element({checked: false, addEventListener(type, fn) { toggle[`on${type}`] = fn; }});
    const status = element();
    const storage = new Map([['warriorsim.shareCompute', stored],
        ['warriorsim.localThreads', localThreads], ['warriorsim.sharedThreads', sharedThreads]]
        .filter(([, value]) => value !== null).map(([key, value]) => [key, String(value)]));
    return {
        toggle, status,
        change(checked) { toggle.checked = checked; toggle.onchange(); },
        emit(type, event) { for (const fn of listeners[type] || []) fn(event); },
        idle: name => entries[name].node.classes.has('share-compute-idle'),
        value: name => entries[name].cell.textContent,
        slider: name => entries[name].input,
        // A range input fires input while dragging and change once it settles.
        drag(name, value) { this.hold(name, value); this.release(name); },
        hold(name, value) {
            const input = entries[name].input;
            input.value = String(value);
            input.oninput();
        },
        release(name) { entries[name].input.onchange(); },
        stored: (key = 'warriorsim.shareCompute') => (storage.has(key) ? storage.get(key) : null),
        context: {
            navigator: {hardwareConcurrency},
            location: {href: 'https://sim.test/index.html', protocol: 'https:'},
            localStorage: {getItem: key => (storage.has(key) ? storage.get(key) : null),
                setItem: (key, value) => storage.set(key, String(value))},
            document: {
                getElementById: id => ({'share-compute': toggle, 'share-compute-status': status}[id] || null),
                querySelectorAll: () => Object.values(entries).map(value => value.node),
            },
            window: {addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }},
            SIMULATOR_BUNDLE: {buildId: BUILD, workerUrl: name => `https://sim.test/dist/bundle/${name}`},
        },
    };
}
const params = () => ({player: [], sim: {iterations: 640, seed: 42, iterationOffset: 13}, fullReport: false});
// A lease as the coordinator sends it, carrying the spec unless a test omits it.
function work(overrides = {}) {
    const value = 'job' in overrides ? overrides.job : job();
    return {type: 'work', leaseId: 'lease', jobId: value ? value.id : overrides.jobId, job: value, index: 0, leaseMs: 15000, ...overrides};
}
module.exports = {ROOT, BUILD, P, job, report, spec, harness, params, dom, work};
