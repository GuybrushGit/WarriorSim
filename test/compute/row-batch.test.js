'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {harness, params, report, job, BUILD, ROOT} = require('./helpers');

function setup(t, {rows = 100, threads = 2, enabled = true, ready = true, iterations = 10000} = {}) {
    const h = harness({getGlobalsDelta: () => ({sod: false})});
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: threads});
    h.api.setClient(client);
    if (enabled) client.setEnabled(true);
    if (enabled && ready) client.socket.open();
    client.beginForeground();
    const batch = new h.api.SimulationRowBatch(threads);
    const completed = [], errors = [];
    for (let row = 0; row < rows; row++) {
        const input = params();
        input.sim = {...input.sim, seed: row, iterations};
        h.api.createSimulationRunner(1, value => completed.push({row, value}), () => {}, value => errors.push(value), batch).start(input);
    }
    t.after(() => { batch.cancel(); client.setEnabled(false); });
    return {...h, client, batch, completed, errors};
}
function finishRemote(socket, run) {
    for (let index = 0; index < run.states.length; index++) {
        if (run.states[index] === 'done' || run.states[index] === 'local') continue;
        socket.deliver({type: 'result', jobId: run.job.id, index, report: report(run.job, index)});
    }
}
function finishLocal(task) {
    while (!task.run.done) task.run.workers[0].worker.finish();
}

test('rows are assigned separately and remote completions refill without waiting for local rows', t => {
    const {client, batch, FakeWorker, completed} = setup(t);
    batch.start();
    const socket = client.socket;
    const submits = () => socket.messages.filter(message => message.type === 'submit');
    assert.equal(batch.local.size, 2);
    assert.equal(batch.remote.size, 64);
    assert.equal(batch.pending.length, 34);
    assert.equal(FakeWorker.all.length, 2, 'remote rows reserve no local worker or local chunk');
    assert.ok(submits().every(message => message.claimed.length === 0));
    assert.deepEqual(submits().map(message => message.job.seed), Array.from({length: 64}, (_, i) => i + 2));
    assert.ok(socket.messages.some(message => message.type === 'mode' && message.busy));
    finishRemote(socket, [...batch.remote][0].run);
    assert.equal(completed[0].row, 2);
    assert.equal(submits().at(-1).job.seed, 66, 'the next untouched row goes straight to the coordinator');
    assert.equal(batch.local.size, 2);
    assert.equal(FakeWorker.all.length, 2);
    finishLocal([...batch.local][0]);
    assert.equal([...batch.local].at(-1).run.job.seed, 67, 'a free local worker takes an untouched row');
    assert.equal(FakeWorker.all.filter(worker => !worker.terminated).length, 2);
    assert.ok(!submits().some(message => [0, 1, 67].includes(message.job.seed)), 'local rows remain private while fresh rows exist');
    assert.ok(!socket.messages.some(message => message.type === 'claim'), 'no competing with remote work before the tail');
});

test('only the tail shares local rows and steals remote work, without exceeding local threads', t => {
    const {client, batch, FakeWorker, completed} = setup(t, {rows: 4});
    batch.start();
    assert.equal(batch.pending.length, 0);
    assert.equal(FakeWorker.all.length, 2);
    const submits = client.socket.messages.filter(message => message.type === 'submit');
    assert.equal(submits.length, 4, 'remaining local chunks are also available to helpers at the tail');
    assert.ok(submits.filter(message => message.job.seed < 2).every(message => message.claimed[0] === 0));
    const remote = [...batch.remote].at(-1).run;
    for (let index = 0; index < remote.states.length; index++) {
        client.socket.deliver({type: 'leased', jobId: remote.job.id, index, leaseId: `lease-${index}`});
    }
    finishLocal([...batch.local][0]);
    assert.ok([...batch.local].some(task => task.run === remote));
    assert.ok(client.socket.messages.some(message => message.type === 'claim' && message.jobId === remote.job.id));
    while (batch.local.size) {
        assert.ok(FakeWorker.all.filter(worker => !worker.terminated).length <= 2);
        finishLocal([...batch.local][0]);
    }
    assert.equal(completed.length, 4);
    assert.equal(new Set(completed.map(value => value.row)).size, 4);
    assert.ok(completed.every(({value}) => value.iterations === 10000));
    assert.equal(client.runs.size, 0);
    assert.equal(client.batches.size, 0);
});

for (const enabled of [true, false]) test(`a ${enabled ? 'connecting' : 'disabled'} client starts locally and submits remote rows when ready`, t => {
    const {client, batch, FakeWorker} = setup(t, {enabled, ready: false});
    batch.start();
    assert.equal(batch.local.size, 2);
    assert.equal(batch.remote.size, 0);
    assert.equal(FakeWorker.all.length, 2);
    if (!enabled) client.setEnabled(true);
    client.socket.open();
    assert.equal(batch.remote.size, 64);
    assert.equal(FakeWorker.all.length, 2, 'joining does not create additional local workers');
    assert.ok(client.socket.messages.filter(message => message.type === 'submit').every(message => message.claimed.length === 0));
});

test('turning sharing off drains fresh rows locally before taking over disconnected remote rows', t => {
    const {client, batch, FakeWorker, completed, errors} = setup(t);
    batch.start();
    const socket = client.socket;
    const remoteIds = new Set([...batch.remote].map(task => task.run.job.id));
    client.setEnabled(false);
    const sent = socket.messages.length;
    while (batch.local.size) {
        if (batch.pending.length) assert.ok([...batch.local].every(task => !remoteIds.has(task.run.job.id)));
        assert.ok(FakeWorker.all.filter(worker => !worker.terminated).length <= 2);
        finishLocal([...batch.local][0]);
    }
    assert.equal(completed.length, 100);
    assert.equal(new Set(completed.map(value => value.row)).size, 100);
    assert.equal(errors.length, 0);
    assert.equal(socket.messages.length, sent);
    assert.equal(client.runs.size, 0);
    assert.equal(client.batches.size, 0);
});

test('reconnecting resubmits remote rows and keeps local rows private', t => {
    const {client, batch, FakeWorker} = setup(t);
    batch.start();
    const remote = [...batch.remote][0].run;
    client.socket.deliver({type: 'result', jobId: remote.job.id, index: 0, report: report(remote.job, 0)});
    client.socket.close();
    client.setEnabled(true);
    client.socket.open();
    const submits = client.socket.messages.filter(message => message.type === 'submit');
    assert.equal(submits.length, 64);
    assert.ok(submits.every(message => message.job.seed >= 2));
    assert.deepEqual(submits.find(message => message.job.id === remote.job.id).claimed, [0]);
    assert.equal(FakeWorker.all.length, 2);
});

test('failure cancels the batch once, including queued and remote-only rows', t => {
    const {client, batch, FakeWorker, errors, completed} = setup(t);
    batch.start();
    const workers = FakeWorker.all.slice();
    workers[0].onerror(new Error('failed row'));
    workers[1].onerror(new Error('late error'));
    assert.equal(errors.length, 1);
    assert.equal(completed.length, 0);
    assert.equal(batch.pending.length, 0);
    assert.equal(client.runs.size, 0);
    assert.equal(client.batches.size, 0);
    assert.ok(FakeWorker.all.every(worker => worker.terminated));
});

test('oversized remote rows defer their local fallback until a local slot is available', t => {
    const {client, batch, FakeWorker, completed, errors} = setup(t, {rows: 3, threads: 1, iterations: 20000000});
    batch.start();
    assert.equal(FakeWorker.all.length, 1);
    assert.ok(!client.socket.messages.some(message => message.type === 'submit'));
    while (batch.local.size) {
        const worker = FakeWorker.all.find(value => !value.terminated);
        const input = worker.messages[0];
        worker.onmessage({data: [1, report(job('large', {iterations: input.sim.iterations,
            chunkSize: input.sim.iterations, seed: input.sim.seed}), 0)]});
        assert.ok(FakeWorker.all.filter(value => !value.terminated).length <= 1);
    }
    assert.equal(completed.length, 3);
    assert.equal(errors.length, 0);
    assert.equal(client.runs.size, 0);
});

test('a batch without a sharing client runs locally with bounded concurrency', t => {
    const {api, FakeWorker} = harness({getGlobalsDelta: () => ({sod: false})});
    const batch = new api.SimulationRowBatch(2);
    const completed = [];
    t.after(() => batch.cancel());
    for (let row = 0; row < 5; row++) batch.createRunner(value => completed.push(value), () => {}, assert.fail).start(params());
    assert.equal(FakeWorker.all.length, 0, 'queueing rows creates no workers');
    batch.start();
    assert.equal(FakeWorker.all.length, 2);
    while (batch.local.size) {
        const worker = FakeWorker.all.find(value => !value.terminated);
        worker.onmessage({data: [1, report(job(), 0)]});
        assert.ok(FakeWorker.all.filter(value => !value.terminated).length <= 2);
    }
    assert.equal(completed.length, 5);
    assert.equal(batch.pending.length, 0);
});

for (const enchant of [false, true]) test(`the ${enchant ? 'enchant' : 'gear'} UI queues all rows and saves all completed results once`, t => {
    const entries = Array.from({length: 70}, (_, id) => ({id}));
    const table = {data: () => 'head', hasClass: () => enchant};
    const cell = () => ({value: '', text(value) {
        if (value === undefined) return this.value;
        this.value = value;
        return this;
    }, append() { return this; }, addClass() { return this; }, css() { return this; }});
    const rows = entries.map(entry => ({
        cell: cell(), done: false,
        find() { return this.cell; }, parents: () => table,
        data: key => key === 'id' ? entry.id : false,
        removeClass() { this.done = true; },
    }));
    const h = harness({navigator: {hardwareConcurrency: 2}, $: value => typeof value === 'string' ? cell() : value,
        gear: {head: entries}, enchant: {head: entries}});
    h.context.Player.getConfig = () => ({});
    vm.runInContext('Simulation.getConfig = () => ({iterations: 640, seed: 42});', h.context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8'), h.context);
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 2});
    h.api.setClient(client);
    client.setEnabled(true);
    client.socket.open();
    client.beginForeground();
    t.after(() => { for (const batch of client.batches) batch.cancel(); client.setEnabled(false); });
    let ended = 0, saved = 0;
    const view = h.context.SIM.UI;
    const sidebar = cell();
    sidebar.value = '10';
    view.sidebar = {find: () => sidebar};
    view.tcontainer = {find: () => ({each() {}})};
    view.endLoading = () => { ended++; client.endForeground(); };
    view.updateSession = () => {
        saved++;
        assert.ok(entries.every(entry => entry.dps === '10.00'), 'persist after the last row updates its DPS');
    };
    view.simulateRows(rows);
    const batch = [...client.batches][0];
    assert.equal(batch.pending.length, 4);
    assert.equal(batch.remote.size, 64);
    assert.equal(h.FakeWorker.all.length, 2);
    while (batch.remote.size) finishRemote(client.socket, [...batch.remote][0].run);
    while (batch.local.size) finishLocal([...batch.local][0]);
    assert.ok(rows.every(row => row.done && row.cell.value === '10.00'));
    assert.equal(ended, 1);
    assert.equal(saved, 1);
    assert.equal(client.busy(), false);
});
