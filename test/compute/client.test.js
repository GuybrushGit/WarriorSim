'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {harness, job, report, params, spec, dom, work, BUILD, P} = require('./helpers');

function setup(t) {
    const h = harness();
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 2});
    t.after(() => { for (const run of client.runs.values()) run.cancel(); client.setEnabled(false); });
    const enable = () => { client.setEnabled(true); h.FakeSocket.all.at(-1).open(); return h.FakeSocket.all.at(-1); };
    return {...h, client, enable};
}

test('a newly constructed client shares nothing until it is enabled', t => {
    const {client, FakeWorker, FakeSocket} = setup(t);
    assert.equal(client.enabled, false);
    client.setEnabled(false);
    assert.equal(FakeWorker.all.length, 0);
    assert.equal(FakeSocket.all.length, 0);
});

test('starting a simulation kills donations synchronously and submits their IDs with its job', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    socket.deliver(work({leaseId: 'lease', index: 4}));
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
    socket.deliver(work({leaseId: 'late-lease', job: job('other'), index: 4}));
    assert.equal(FakeWorker.all.length, 3);
    assert.deepEqual(socket.messages.at(-1), {type: 'abandon', cancelled: ['late-lease'], buildId: BUILD});
});

test('mixed remote and local ranges merge once, preserve offsets, and return to pull', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    let final;
    const run = new api.SharedSimulation(client, 1, value => { final = value; }, () => {}, assert.fail);
    run.start(params());
    const remote = {type: 'result', jobId: run.job.id, index: 3, report: report(run.job, 3)};
    socket.deliver(remote);
    socket.deliver(remote);
    const local = FakeWorker.all[0];
    while (!final) local.finish();
    assert.equal(final.iterations, 640);
    assert.equal(final.totaldmg, 64000);
    assert.deepEqual(local.messages.map(value => value.offset), [13, 141, 269, 525]);
    assert.equal(local.terminated, true);
    assert.deepEqual(socket.messages.at(-1), {type: 'finish', jobId: run.job.id, busy: false, buildId: BUILD});
});

test('local workers immediately steal the remote tail and ignore its late results', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    let final;
    const run = new api.SharedSimulation(client, 1, value => { final = value; }, () => {}, assert.fail);
    run.start(params());
    for (let index = 1; index < run.states.length; index++) socket.deliver({type: 'leased', jobId: run.job.id, index, leaseId: `lease-${index}`});
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
    socket.deliver({type: 'leased', jobId: run.job.id, index: 3, leaseId: 'lease'});
    const worker = FakeWorker.all[0];
    client.setEnabled(false);
    assert.equal(worker.terminated, false);
    assert.equal(run.states[3], 'pending');
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
    for (const [leaseId, index] of [['lease-a', 3], ['lease-b', 4]]) socket.deliver(work({leaseId, index}));
    new h.api.SharedSimulation(client, 2, () => {}, () => {}, assert.fail).start(params());
    assert.deepEqual(socket.messages.find(message => message.type === 'submit').cancelled, ['lease-a', 'lease-b']);
    assert.equal(h.FakeWorker.all.filter(worker => !worker.terminated).length, 2);
});

test('opt-out discards donated completions, queued work and remote results from the closed socket', t => {
    const {api, client, enable, FakeWorker, FakeSocket} = setup(t);
    const socket = enable();
    socket.deliver(work({leaseId: 'donated', index: 4}));
    const donated = FakeWorker.all[0];
    const callback = donated.onmessage;
    client.setEnabled(false);
    const sent = socket.messages.length;
    callback({data: {id: 'donated', report: report(job(), 4)}});
    socket.deliver(work({leaseId: 'late', index: 4}));
    assert.equal(donated.terminated, true);
    assert.equal(client.donations.size, 0);
    assert.equal(FakeWorker.all.length, 1);
    assert.equal(socket.messages.length, sent);
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    socket.deliver({type: 'result', jobId: run.job.id, index: 3, report: report(run.job, 3)});
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
    socket.deliver({type: 'leased', jobId: run.job.id, index: 3, leaseId: 'slow'});
    socket.deliver({type: 'unavailable', jobId: run.job.id});
    assert.equal(run.attached, false);
    assert.equal(run.states[3], 'pending');
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

function panel(t, {max = 12, ...options} = {}) {
    const fake = dom(options);
    const h = harness(fake.context);
    h.api.initSharedCompute(max);
    const client = h.api.getClient();
    t.after(() => client.setEnabled(false));
    const ready = (extra = {}) => {
        const socket = h.FakeSocket.all.at(-1);
        socket.readyState = 1;
        socket.onopen();
        socket.deliver({type: 'ready', protocol: P.version, ...extra});
        return socket;
    };
    return {...h, fake, client, ready};
}

test('sharing is on by default and reports local threads before any coordinator replies', t => {
    const {fake, client, FakeSocket} = panel(t);
    assert.equal(fake.toggle.checked, true);
    assert.equal(client.enabled, true);
    assert.equal(FakeSocket.all.length, 1, 'the default opt-in connects on load');
    assert.equal(fake.value('local'), '12 threads', 'local defaults to the whole machine');
    assert.equal(fake.idle('local'), false, 'local workers run every simulation, shared or not');
    assert.equal(fake.value('shared'), '5 threads'); // floor(12 * 0.45).
    assert.equal(fake.idle('shared'), false);
    assert.equal(fake.value('network'), '—', 'the pool size is unknown until a coordinator reports it');
    assert.equal(fake.idle('network'), false);
});

test('opting out persists, dims both sharing rows, and keeps the local row live', t => {
    const {fake, client} = panel(t);
    fake.change(false);
    assert.equal(fake.stored(), 'false');
    assert.equal(client.enabled, false);
    assert.equal(fake.idle('network'), true);
    assert.equal(fake.idle('shared'), true);
    assert.equal(fake.value('shared'), '5 threads', 'the dimmed row still shows what would be shared');
    assert.equal(fake.idle('local'), false);
    assert.equal(fake.value('local'), '12 threads');
    fake.change(true);
    assert.equal(fake.stored(), 'true');
    assert.equal(client.enabled, true);
    assert.equal(fake.idle('shared'), false);
});

test('only a stored refusal turns sharing off on the next load', t => {
    assert.equal(panel(t, {stored: 'false'}).client.enabled, false);
    assert.equal(panel(t, {stored: 'true'}).client.enabled, true);
    assert.equal(panel(t, {stored: null}).client.enabled, true);
});

test('the coordinator pool size fills the network row and survives reconnects', t => {
    const {fake, client, ready} = panel(t);
    const socket = ready({networkThreads: 37});
    assert.equal(fake.value('network'), '37 threads');
    assert.equal(client.networkThreads, 37);
    socket.close();
    client.connect();
    ready({networkThreads: 1});
    assert.equal(fake.value('network'), '1 thread');
    socket.close();
    client.connect();
    // Being alone in the pool is a real count of zero, not a missing one.
    ready({networkThreads: 0});
    assert.equal(client.networkThreads, 0);
    assert.equal(fake.value('network'), '0 threads');
});

test('a coordinator that reports no pool size leaves the network row unknown', t => {
    const {fake, client, ready} = panel(t);
    ready({networkThreads: 12});
    client.socket.close();
    client.connect();
    ready();
    assert.equal(client.networkThreads, undefined);
    assert.equal(fake.value('network'), '—');
    client.socket.close();
    client.connect();
    ready({networkThreads: -3});
    assert.equal(fake.value('network'), '—', 'a malformed count is discarded, not displayed');
});

test('another tab opting out revokes sharing here without reconnecting', t => {
    const {fake, client, FakeSocket} = panel(t);
    assert.equal(client.enabled, true);
    fake.emit('storage', {key: 'warriorsim.shareCompute', newValue: 'false'});
    assert.equal(fake.toggle.checked, false);
    assert.equal(client.enabled, false);
    assert.equal(fake.idle('shared'), true);
    const connections = FakeSocket.all.length;
    fake.emit('storage', {key: 'warriorsim.shareCompute', newValue: 'true'});
    assert.equal(client.enabled, false, 'opting back in stays an explicit action in this tab');
    assert.equal(FakeSocket.all.length, connections);
});

test('the thread sliders expose their ranges and defaults', t => {
    const {fake, api} = panel(t);
    assert.deepEqual([fake.slider('local').min, fake.slider('local').max, fake.slider('local').value],
        ['1', '12', '12'], 'local runs 1..max and defaults to the maximum');
    assert.deepEqual([fake.slider('shared').min, fake.slider('shared').max, fake.slider('shared').value],
        ['2', '12', '5'], 'shared runs 2..max and defaults to floor(45% of max)');
    assert.equal(fake.slider('local').disabled, false);
    assert.equal(api.sharedComputeLocalThreads(), 12);
});

test('a single-core machine keeps the shared floor instead of an inverted range', t => {
    const {fake, api} = panel(t, {max: 1});
    assert.deepEqual([fake.slider('local').min, fake.slider('local').max, fake.slider('local').value], ['1', '1', '1']);
    assert.equal(fake.slider('local').disabled, true, 'nothing to choose between');
    assert.deepEqual([fake.slider('shared').min, fake.slider('shared').max, fake.slider('shared').value],
        ['2', '2', '2'], 'the floor of two still applies');
    assert.equal(api.sharedComputeLocalThreads(), 1);
});

test('dragging the local slider retargets simulations and persists on release', t => {
    const {fake, api} = panel(t);
    fake.hold('local', 3);
    assert.equal(api.sharedComputeLocalThreads(), 3, 'the count follows the drag');
    assert.equal(fake.value('local'), '3 threads');
    assert.equal(fake.stored('warriorsim.localThreads'), null, 'nothing is written mid-drag');
    fake.release('local');
    assert.equal(fake.stored('warriorsim.localThreads'), '3');
    fake.drag('local', 1);
    assert.equal(fake.value('local'), '1 thread', 'the singular label still applies');
});

test('the shared slider republishes its capacity to the coordinator only on release', t => {
    const {fake, client, ready} = panel(t);
    const socket = ready({networkThreads: 40});
    const before = socket.messages.length;
    fake.hold('shared', 9);
    assert.equal(client.slots, 9);
    assert.equal(fake.value('shared'), '9 threads');
    assert.equal(socket.messages.length, before, 'a drag does not touch the socket');
    assert.equal(fake.value('network'), '40 threads');
    fake.release('shared');
    assert.deepEqual(socket.messages.at(-1), {type: 'mode', busy: false, slots: 9, queue: 36, buildId: BUILD});
    assert.equal(fake.stored('warriorsim.sharedThreads'), '9');
    assert.equal(fake.value('network'), '40 threads', 'the peer total excludes us, so our own change leaves it alone');
    fake.drag('shared', 9);
    assert.equal(socket.messages.filter(message => message.type === 'mode').length, 1, 'no message without a change');
});

test('an unpublished capacity change rides along on the next handshake', t => {
    const {fake, client, ready} = panel(t);
    fake.drag('shared', 7);
    assert.equal(client.enabled, true);
    assert.equal(client.ready, undefined, 'still connecting, so nothing was published');
    const socket = ready();
    assert.equal(socket.messages[0].type, 'hello');
    assert.equal(socket.messages[0].slots, 7);
    assert.equal(socket.messages[0].queue, 28, 'a full window until round trips and chunks are measured');
});

test('stored thread counts are restored and re-clamped to the current machine', t => {
    assert.equal(panel(t, {localThreads: 4, sharedThreads: 3}).fake.value('local'), '4 threads');
    assert.equal(panel(t, {localThreads: 4, sharedThreads: 3}).fake.value('shared'), '3 threads');
    // A profile carried over from a larger machine, and one from below the shared floor.
    assert.equal(panel(t, {localThreads: 999}).fake.value('local'), '12 threads');
    assert.equal(panel(t, {sharedThreads: 1}).fake.value('shared'), '2 threads');
    assert.equal(panel(t, {localThreads: 0}).fake.value('local'), '1 thread');
    assert.equal(panel(t, {localThreads: 'nonsense'}).fake.value('local'), '12 threads', 'falls back to the default');
});

test('own and donated workers use the pinned bundle URL after a deployment', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    client.workerUrl = 'https://sim.test/dist/js/compute-worker.min.js';
    const socket = enable();
    socket.deliver(work({leaseId: 'lease', index: 4}));
    client.beginForeground();
    const run = new api.SharedSimulation(client, 2, () => {}, () => {}, assert.fail);
    run.start(params());
    assert.equal(FakeWorker.all.length, 3);
    assert.ok(FakeWorker.all.every(worker => worker.url === client.workerUrl));
});

// A later lease for a job whose spec this connection already holds.
const again = overrides => work({job: undefined, jobId: 'job', ...overrides});

test('leases beyond the shared thread count wait in order and reuse the finished worker', t => {
    const {client, enable, FakeWorker} = setup(t);
    const statuses = [];
    client.onStatus = value => statuses.push(value);
    const socket = enable();
    socket.deliver(work({leaseId: 'lease-0', index: 0}));
    for (let index = 1; index < 5; index++) socket.deliver(again({leaseId: `lease-${index}`, index}));
    assert.equal(FakeWorker.all.length, 2, 'only as many workers as shared threads');
    assert.equal(client.donations.size, 5);
    assert.deepEqual([...client.waiting], ['lease-2', 'lease-3', 'lease-4']);
    assert.equal(statuses.at(-1), 'Sharing compute · 2 workers · 3 queued');
    const first = FakeWorker.all[0];
    assert.equal(first.messages[0].id, 'lease-0');
    first.finish();
    const result = socket.messages.filter(message => message.type === 'result').at(-1);
    assert.equal(result.leaseId, 'lease-0');
    assert.ok(Number.isSafeInteger(result.sent), 'the send time rides along for the round-trip echo');
    assert.equal(FakeWorker.all.length, 2, 'the finished worker takes the next waiting lease');
    assert.deepEqual(JSON.parse(JSON.stringify(first.messages.at(-1))), {id: 'lease-2', jobId: 'job', spec: spec(),
        seed: 42, fullReport: false, offset: 13 + 2 * 128, count: 128});
    assert.deepEqual([...client.waiting], ['lease-3', 'lease-4']);
    assert.equal(statuses.at(-1), 'Sharing compute · 2 workers · 2 queued');
    while (client.donations.size) FakeWorker.all[client.donations.size % 2].finish();
    assert.equal(statuses.at(-1), 'Ready to share');
    assert.equal(socket.messages.filter(message => message.type === 'result').length, 5);
});

test('cancelling waiting work costs nothing, cancelling running work starts the next', t => {
    const {client, enable, FakeWorker} = setup(t);
    client.setSlots(1);
    const socket = enable();
    socket.deliver(work({leaseId: 'running', index: 0}));
    socket.deliver(again({leaseId: 'waiting', index: 1}));
    socket.deliver(again({leaseId: 'last', index: 2}));
    assert.equal(FakeWorker.all.length, 1);
    socket.deliver({type: 'cancel', leaseId: 'waiting'});
    assert.equal(FakeWorker.all.length, 1);
    assert.equal(FakeWorker.all[0].terminated, false);
    assert.deepEqual([...client.waiting], ['last']);
    socket.deliver({type: 'cancel', leaseId: 'running'});
    assert.equal(FakeWorker.all[0].terminated, true);
    assert.equal(FakeWorker.all.length, 2, 'the next waiting lease starts on a fresh worker');
    assert.equal(FakeWorker.all[1].messages[0].id, 'last');
    assert.equal(client.active, 1);
    assert.deepEqual([...client.waiting], []);
    assert.equal(socket.messages.some(message => message.type === 'abandon'), false, 'a cancel needs no reply');
});

test('a foreground simulation drops waiting leases without starting them and keeps the retained specs', t => {
    const {api, client, enable, FakeWorker} = setup(t);
    const socket = enable();
    socket.deliver(work({leaseId: 'a', index: 0}));
    socket.deliver(again({leaseId: 'b', index: 1}));
    socket.deliver(again({leaseId: 'c', index: 2}));
    client.beginForeground();
    assert.equal(FakeWorker.all.length, 2, 'no worker was created just to be terminated');
    assert.ok(FakeWorker.all.every(worker => worker.terminated));
    socket.deliver(work({leaseId: 'late', job: job('other'), index: 0}));
    assert.deepEqual(socket.messages.at(-1), {type: 'abandon', cancelled: ['late'], buildId: BUILD});
    const run = new api.SharedSimulation(client, 1, () => {}, () => {}, assert.fail);
    run.start(params());
    assert.deepEqual(socket.messages.find(message => message.type === 'submit').cancelled, ['a', 'b', 'c']);
    while (!run.done) FakeWorker.all.at(-1).finish();
    client.endForeground();
    socket.deliver(again({leaseId: 'd', index: 3}));
    socket.deliver(again({leaseId: 'e', index: 1, jobId: 'other'}));
    assert.equal(client.donations.size, 2, 'specs from before the simulation, even from a rejected lease, still serve');
    assert.equal(socket.readyState, 1);
});

test('a lease naming an unknown or forgotten job closes the connection for a clean restart', t => {
    const {client, enable} = setup(t);
    const socket = enable();
    socket.deliver(again({leaseId: 'unknown', index: 0}));
    assert.equal(socket.readyState, 3, 'the coordinator and this tab disagree about what was sent');
    assert.equal(client.donations.size, 0);
    const next = enable();
    next.deliver(work({leaseId: 'first', index: 0}));
    next.deliver({type: 'forget', jobId: 'job'});
    assert.equal(client.jobs.size, 0);
    assert.equal(client.donations.size, 1, 'the running lease keeps its own copy');
    next.deliver(again({leaseId: 'second', index: 1}));
    assert.equal(next.readyState, 3);
    assert.equal(client.donations.size, 0);
});

test('the queue follows measured round trips and chunk times', t => {
    let time = 0;
    const h = harness();
    const client = new h.api.SharedComputeClient({url: 'ws://test/compute', buildId: BUILD, slots: 4, now: () => time});
    t.after(() => client.setEnabled(false));
    client.setEnabled(true);
    const socket = h.FakeSocket.all[0];
    socket.readyState = 1;
    socket.onopen();
    assert.equal(socket.messages[0].queue, 16, 'a full window before any measurement');
    time = 40;
    socket.deliver({type: 'ready', protocol: P.version, leaseMs: 15000});
    assert.deepEqual([...client.samples.rtt], [40], 'the handshake is the first round trip');
    const modes = () => socket.messages.filter(message => message.type === 'mode');
    let leases = 0;
    const chunks = (ms, count) => {
        for (let i = 0; i < count; i++) {
            const leaseId = `lease-${++leases}`;
            socket.deliver(leases > 1 ? again({leaseId, index: 1}) : work({leaseId, index: 0}));
            time += ms;
            h.FakeWorker.all.find(worker => !worker.terminated && worker.messages.at(-1).id === leaseId).finish();
        }
    };
    // A 20 ms chunk against a 40 ms round trip: each thread needs three leases in flight.
    chunks(20, 1);
    assert.deepEqual([...client.samples.chunk], [20]);
    assert.equal(client.queue, 15);
    assert.equal(modes().length, 0, 'the initial window is already within the hysteresis band');
    assert.equal(socket.messages.at(-1).sent, 60, 'the result carried its send time');
    // The coordinator echoes that send time; a slower sample never lowers the minimum.
    time = 200;
    socket.deliver(again({leaseId: 'echoed', index: 1, echo: 60}));
    assert.deepEqual([...client.samples.rtt], [40, 140]);
    assert.equal(client.queue, 15);
    socket.deliver({type: 'cancel', leaseId: 'echoed'});
    // A busier machine: chunks stretch to 200 ms and the queue shrinks toward the thread count.
    chunks(200, 16);
    assert.equal(client.queue, 6);
    client.publish(); // Explicit publishing also sends changes held by hysteresis.
    assert.equal(modes().at(-1).queue, 6);
    // A change inside the hysteresis band is kept locally and rides along on the next publish.
    chunks(170, 16);
    assert.equal(client.queue, 7);
    assert.equal(modes().at(-1).queue, 6, 'one lease either way is not worth a message');
    client.setSlots(5);
    client.publish();
    assert.deepEqual(modes().at(-1), {type: 'mode', busy: false, slots: 5, queue: 8, buildId: BUILD});
    // Very slow chunks: waiting work must still start inside half a lease.
    chunks(10000, 16);
    assert.equal(client.queue, 5);
    assert.equal(modes().at(-1).queue, 5);
    assert.ok(modes().every(message => message.queue >= message.slots && message.queue <= 4 * message.slots));
});

test('shared jobs leave enough chunks for helpers, including single-worker sheet rows', t => {
    const {api, client, enable} = setup(t);
    enable();
    const size = (threads, iterations) => {
        const run = new api.SharedSimulation(client, threads, () => {}, () => {}, assert.fail);
        const input = params();
        input.sim.iterations = iterations;
        run.start(input);
        const chunkSize = run.job.chunkSize;
        run.cancel();
        return chunkSize;
    };
    assert.equal(size(16, 50000), 196);
    assert.equal(size(1, 10000), 625, 'a sheet row leaves fifteen chunks for helpers');
    assert.equal(size(1, 50000), 2000);
    assert.equal(size(16, 1000), 128);
});
