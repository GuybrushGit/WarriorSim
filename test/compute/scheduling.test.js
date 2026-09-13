'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {Coordinator} = require('../../server/coordinator');
const {BUILD, harness, job, params, report} = require('./helpers');

// Run the real client and coordinator against a deterministic clock. Network messages
// take one hop in each direction; workers take time proportional to their chunk size.
// This exercises replenishment and the Sheet DPS row pipeline without timing assertions
// depending on the CPU running the test.
function sheet({rows = 256, localThreads = 16, sharedThreads = 20, iterations = 10000,
    hopMs = 20, localMs = 0.4, helperMs = 0.04} = {}) {
    let time = 0, sequence = 0;
    const events = new Map();
    const later = (callback, ms = 0) => {
        const id = ++sequence;
        events.set(id, {at: time + ms, callback});
        return id;
    };
    const cancel = id => events.delete(id);
    const until = check => {
        let steps = 0;
        while (!check()) {
            assert.ok(events.size && ++steps < 100000, 'the workload must make progress');
            const [id, event] = [...events].reduce((a, b) => a[1].at <= b[1].at ? a : b);
            events.delete(id);
            time = event.at;
            event.callback();
        }
    };
    const server = new Coordinator({now: () => time});
    class Socket {
        constructor() {
            this.bufferedAmount = 0;
            this.readyState = 0;
            this.client = server.connect(message => later(() => {
                if (this.readyState === 1) this.onmessage({data: JSON.stringify(message)});
            }, hopMs));
            later(() => { this.readyState = 1; this.onopen(); });
        }
        send(data) {
            later(() => {
                if (this.readyState === 1) server.receive(this.client, JSON.parse(data));
            }, hopMs);
        }
        close() { this.readyState = 3; server.disconnect(this.client); }
    }
    const participant = (slots, ms) => {
        let active = 0, peakWorkers = 0;
        class Worker {
            postMessage(data) {
                assert.ok(!this.running, 'a worker must finish its current chunk before starting another');
                this.running = true;
                peakWorkers = Math.max(peakWorkers, ++active);
                this.timer = later(() => {
                    this.running = false;
                    active--;
                    this.onmessage({data: {id: data.id,
                        report: report(job('row', {iterations: data.count, chunkSize: data.count,
                            offset: data.offset, seed: data.seed}), 0)}});
                }, data.count * ms);
            }
            terminate() {
                cancel(this.timer);
                if (this.running) active--;
                this.running = false;
            }
        }
        const {api} = harness({Worker, WebSocket: Socket, setTimeout: later, clearTimeout: cancel});
        const client = new api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD,
            slots, now: () => time});
        client.setEnabled(true);
        return {client, api, peakWorkers: () => peakWorkers};
    };
    const owner = participant(localThreads, localMs);
    const helper = participant(sharedThreads, helperMs).client;
    until(() => owner.client.ready && helper.ready);
    const batch = new owner.api.SimulationRowBatch(localThreads, owner.client);
    const started = time;
    const gaps = [];
    let changed = time, activeTime = 0, previousActive = 0, peak = 0, idleSince, maxIdle = 0;
    helper.onStatus = () => {
        activeTime += previousActive * (time - changed);
        changed = time;
        peak = Math.max(peak, helper.active);
        if (helper.active === 0 && idleSince === undefined) idleSince = time;
        if (helper.active > 0 && idleSince !== undefined) {
            if (time > idleSince) gaps.push({from: idleSince - started, to: time - started, unassigned: batch.pending.length});
            maxIdle = Math.max(maxIdle, time - idleSince);
            idleSince = undefined;
        }
        previousActive = helper.active;
    };
    let completed = 0, remoteIterations = 0;
    const receive = owner.client.receive.bind(owner.client);
    owner.client.receive = message => {
        if (message.type === 'result') remoteIterations += message.report.iterations;
        receive(message);
    };
    owner.client.beginForeground();
    for (let row = 0; row < rows; row++) {
        const run = batch.createRunner(value => {
            assert.equal(value.iterations, iterations);
            completed++;
        }, () => {}, assert.fail);
        const input = params();
        input.sim.iterations = iterations;
        run.start(input);
    }
    batch.start();
    until(() => completed === rows);
    helper.status();
    const elapsed = time - started;
    const metrics = {elapsed, peak, maxIdle, utilization: activeTime / (elapsed * sharedThreads), remoteIterations, gaps};
    owner.client.endForeground();
    until(() => server.jobs.size === 0 && helper.donations.size === 0);
    owner.client.setEnabled(false);
    helper.setEnabled(false);
    assert.equal(owner.peakWorkers(), localThreads, 'row lookahead must not exceed the local thread limit');
    assert.equal(server.leases.size, 0);
    return metrics;
}

test('Sheet DPS keeps a 20-thread helper fed alongside 16 local rows of 10000 iterations', t => {
    const metrics = sheet();
    t.diagnostic(JSON.stringify(metrics));
    assert.equal(metrics.peak, 20);
    assert.ok(metrics.utilization > 0.9, 'the helper should contribute throughout successive rows');
    assert.equal(metrics.maxIdle, 0, 'after starting, the helper must not drain between rows');
});
