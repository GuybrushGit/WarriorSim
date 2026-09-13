'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {harness, job, report, params, spec, BUILD} = require('./helpers');

function setup(t) {
    const h = harness();
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 2});
    t.after(() => { for (const run of client.runs.values()) run.cancel(); client.setEnabled(false); });
    const enable = () => { client.setEnabled(true); h.FakeSocket.all.at(-1).open(); return h.FakeSocket.all.at(-1); };
    return {...h, client, enable};
}

test('sharing defaults off and creates no connection or workers', t => {
    const {client, FakeWorker, FakeSocket} = setup(t);
    assert.equal(client.enabled, false);
    client.setEnabled(false);
    assert.equal(FakeWorker.all.length, 0);
    assert.equal(FakeSocket.all.length, 0);
});

test('starting a simulation kills donations synchronously and submits their IDs with its job', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    socket.deliver({type: 'work', leaseId: 'lease', job: job(), index: 4, leaseMs: 15000});
    const donated = FakeWorker.all[0];
    client.beginForeground();
    assert.equal(donated.terminated, true);
    assert.equal(socket.messages.some(message => message.type === 'abandon' || message.type === 'mode'), false,
        'the cancellation list is retained for the same submit that publishes foreground work');
    const run = new api.SharedSimulation(client, 2, () => {}, () => {}, assert.fail);
    run.start(params());
    const submit = socket.messages.find(message => message.type === 'submit');
    assert.deepEqual(submit.cancelled, ['lease']);
    assert.deepEqual(submit.claimed, [0, 1]);
    assert.equal(FakeWorker.all.filter(worker => !worker.terminated).length, 2);
    socket.deliver({type: 'work', leaseId: 'late-lease', job: job('other'), index: 4, leaseMs: 15000});
    assert.equal(FakeWorker.all.length, 3);
    assert.deepEqual(socket.messages.at(-1), {type: 'abandon', cancelled: ['late-lease'], buildId: BUILD});
});

test('mixed remote and local ranges merge once, preserve offsets, and return to pull', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    let final;
    const run = new api.SharedSimulation(client, 1, value => { final = value; }, () => {}, assert.fail);
    run.start(params());
    const remote = {type: 'result', jobId: run.job.id, index: 4, report: report(run.job, 4)};
    socket.deliver(remote);
    socket.deliver(remote);
    const local = FakeWorker.all[0];
    while (!final) local.finish();
    assert.equal(final.iterations, 640);
    assert.equal(final.totaldmg, 64000);
    assert.deepEqual(local.messages.map(value => value.offset), [13, 141, 269, 397]);
    assert.equal(local.terminated, true);
    assert.deepEqual(socket.messages.at(-1), {type: 'finish', jobId: run.job.id, busy: false, buildId: BUILD});
});

test('local workers immediately steal the remote tail and ignore its late results', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    let final;
    const run = new api.SharedSimulation(client, 1, value => { final = value; }, () => {}, assert.fail);
    run.start(params());
    for (let index = 1; index < 5; index++) socket.deliver({type: 'leased', jobId: run.job.id, index, leaseId: `lease-${index}`});
    const local = FakeWorker.all[0];
    local.finish();
    assert.equal(local.messages.at(-1).offset, 141);
    socket.deliver({type: 'result', jobId: run.job.id, index: 1, report: report(run.job, 1)});
    assert.equal(run.report.iterations, 128);
    while (!final) local.finish();
    assert.equal(final.iterations, 640);
    assert.equal(socket.messages.filter(message => message.type === 'claim').length, 4);
});

test('turning sharing off keeps current local workers and completes all missing ranges', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    let final;
    const run = new api.SharedSimulation(client, 1, value => { final = value; }, () => {}, assert.fail);
    run.start(params());
    socket.deliver({type: 'leased', jobId: run.job.id, index: 4, leaseId: 'lease'});
    const worker = FakeWorker.all[0];
    client.setEnabled(false);
    assert.equal(worker.terminated, false);
    assert.equal(run.states[4], 'pending');
    while (!final) worker.finish();
    assert.equal(final.iterations, 640);
    assert.equal(worker.messages.length, 5);
});

test('the UI runner uses ordinary local workers while sharing is disabled', t => {
    const {api, FakeWorker, FakeSocket} = harness({getGlobalsDelta: () => ({sod: false})});
    const client = new api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 2});
    api.setClient(client);
    const run = api.createSimulationRunner(2, () => {}, () => {}, assert.fail);
    t.after(() => run.cancel());
    assert.equal(run.constructor.name, 'SimulationWorkerParallel');
    const input = params();
    input.player = [null, null, null, {}];
    run.start(input);
    assert.equal(FakeSocket.all.length, 0);
    assert.equal(client.runs.size, 0);
    assert.equal(FakeWorker.all.length, 2);
    assert.ok(FakeWorker.all.every(worker => worker.url === './dist/js/sim-worker.min.js'));
    assert.deepEqual(FakeWorker.all.map(worker => [worker.messages[0].sim.iterationOffset, worker.messages[0].sim.iterations]),
        [[13, 320], [333, 320]]);
});

test('foreground work preempts every donation before resolving the player or starting its workers', t => {
    let h;
    h = harness({Player: class {
        constructor() {
            assert.ok(h.FakeWorker.all.every(worker => worker.terminated), 'all donor workers stop before Player construction');
            this.mh = {};
        }
        serializeSimulationSpec() { return spec(); }
    }});
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 2});
    t.after(() => { for (const run of client.runs.values()) run.cancel(); client.setEnabled(false); });
    client.setEnabled(true);
    const socket = h.FakeSocket.all[0];
    socket.open();
    for (const [leaseId, index] of [['lease-a', 3], ['lease-b', 4]]) {
        socket.deliver({type: 'work', leaseId, job: job(), index, leaseMs: 15000});
    }
    new h.api.SharedSimulation(client, 2, () => {}, () => {}, assert.fail).start(params());
    assert.deepEqual(socket.messages.find(message => message.type === 'submit').cancelled, ['lease-a', 'lease-b']);
    assert.equal(h.FakeWorker.all.filter(worker => !worker.terminated).length, 2);
});

test('opt-out discards donated completions, queued work and remote results from the closed socket', t => {
    const {api, client, enable, FakeWorker, FakeSocket} = setup(t);
    const socket = enable();
    socket.deliver({type: 'work', leaseId: 'donated', job: job(), index: 4, leaseMs: 15000});
    const donated = FakeWorker.all[0];
    const callback = donated.onmessage;
    client.setEnabled(false);
    const sent = socket.messages.length;
    callback({data: {id: 'donated', report: report(job(), 4)}});
    socket.deliver({type: 'work', leaseId: 'late', job: job(), index: 4, leaseMs: 15000});
    assert.equal(donated.terminated, true);
    assert.equal(client.donations.size, 0);
    assert.equal(FakeWorker.all.length, 1);
    assert.equal(socket.messages.length, sent);
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    socket.deliver({type: 'result', jobId: run.job.id, index: 4, report: report(run.job, 4)});
    assert.equal(run.report, undefined);
    while (!run.done) FakeWorker.all[1].finish();
    assert.equal(run.report.iterations, 640);
    assert.equal(FakeWorker.all[1].messages.length, 5);
    assert.equal(FakeSocket.all.length, 1);
    assert.equal(socket.messages.length, sent);
});

test('a coordinator unavailable response leaves every unfinished range available locally', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    socket.deliver({type: 'leased', jobId: run.job.id, index: 4, leaseId: 'slow'});
    socket.deliver({type: 'unavailable', jobId: run.job.id});
    assert.equal(run.attached, false);
    assert.equal(run.states[4], 'pending');
    while (!run.done) FakeWorker.all[0].finish();
    assert.deepEqual(FakeWorker.all[0].messages.map(value => [value.offset, value.count]),
        [[13, 128], [141, 128], [269, 128], [397, 128], [525, 128]]);
    assert.equal(run.report.iterations, 640);
    assert.equal(client.busy(), false);
});

test('disconnect and reconnect resubmit only unfinished ranges without restarting local work', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    FakeWorker.all[0].finish();
    socket.close();
    enable();
    const submit = FakeSocketLast().messages.find(message => message.type === 'submit');
    assert.deepEqual(submit.claimed, [0, 1]);
    assert.equal(FakeWorker.all.length, 1);
    function FakeSocketLast() { return client.socket; }
});

test('worker failure cancels siblings and releases the server job once', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    const errors = [];
    const run = new api.SharedSimulation(client, 2, assert.fail, () => {}, error => errors.push(error));
    run.start(params());
    FakeWorker.all[0].onerror(new Error('WASM failure'));
    FakeWorker.all[1].onerror(new Error('late failure'));
    assert.equal(errors.length, 1);
    assert.ok(FakeWorker.all.every(worker => worker.terminated));
    assert.equal(socket.messages.filter(message => message.type === 'finish').length, 1);
});

test('ending a UI batch resumes pull only after its last simulation finishes', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    client.beginForeground();
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    client.endForeground();
    assert.equal(socket.messages.at(-1).busy, true);
    while (!run.done) FakeWorker.all[0].finish();
    assert.equal(socket.messages.at(-1).busy, false);
});

test('configurations outside sharing bounds stay in push mode throughout the local fallback', t => {
    const {api, FakeWorker, FakeSocket} = harness({getGlobalsDelta: () => ({sod: true})});
    const client = new api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 1});
    t.after(() => { for (const run of client.runs.values()) run.cancel(); client.setEnabled(false); });
    client.setEnabled(true);
    const socket = FakeSocket.all[0];
    socket.open();
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, () => {});
    const input = params();
    input.sim.iterations = 20000000; // More chunks than the coordinator accepts.
    input.player = [null, null, null, {}];
    run.start(input);
    assert.equal(socket.messages.some(message => message.type === 'submit'), false);
    assert.ok(socket.messages.some(message => message.type === 'mode' && message.busy));
    assert.equal(FakeWorker.all.length, 1);
    assert.equal(client.busy(), true);
    FakeWorker.all[0].onmessage({data: [1, report(job('fallback', {iterations: input.sim.iterations, chunkSize: input.sim.iterations}), 0)]});
    assert.equal(client.busy(), false);
    assert.equal(socket.messages.at(-1).busy, false);
});

test('the startup hash is immutable and tags every outgoing request, including reconnects', t => {
    const {api, client, enable, FakeWorker, FakeSocket} = setup(t);
    const socket = enable();
    const original = client.buildId;
    assert.throws(() => { client.buildId = 'b'.repeat(64); }, TypeError);
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    FakeWorker.all[0].finish();
    socket.close();
    enable();
    while (!run.done) FakeWorker.all[0].finish();
    client.endForeground();
    for (const connection of FakeSocket.all) assert.ok(connection.messages.every(message => message.buildId === original));
    assert.throws(() => client.receive({type: 'work', buildId: 'b'.repeat(64), job: job()}), /different bundle/);
    assert.throws(() => client.receive({type: 'cancel', leaseId: 'anything'}), /different bundle/);
});

test('own and donated workers use the pinned bundle URL after a deployment', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    client.workerUrl = `https://sim.test/dist/bundles/${BUILD}/js/compute-worker.min.js`;
    const socket = enable();
    socket.deliver({type: 'work', leaseId: 'lease', job: job(), index: 4, leaseMs: 15000});
    client.beginForeground();
    const run = new api.SharedSimulation(client, 2, () => {}, () => {}, assert.fail);
    run.start(params());
    assert.equal(FakeWorker.all.length, 3);
    assert.ok(FakeWorker.all.every(worker => worker.url === client.workerUrl));
});
