'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {Coordinator} = require('../../server/coordinator');
const {job, report, P, BUILD} = require('./helpers');

const receive = (server, client, message) => server.receive(client, {buildId: client.buildId, ...message});

function setup() {
    let time = 100;
    const server = new Coordinator({now: () => time, leaseMs: 1000});
    const join = (slots = 1, buildId = BUILD) => {
        const messages = [];
        const client = server.connect(message => messages.push(message));
        receive(server, client, {type: 'hello', protocol: P.version, buildId, share: true, slots});
        return {client, messages};
    };
    const submit = (owner, value = job(), claimed = [0], cancelled = []) =>
        receive(server, owner.client, {type: 'submit', job: value, claimed, cancelled});
    return {server, join, submit, advance: () => { time += 1001; server.tick(); }};
}

test('only opted-in participants with a valid bundle hash and supported protocol can join', () => {
    const {server} = setup();
    for (const changes of [{share: false}, {buildId: 'old'}, {protocol: 99}, {slots: 0}, {busy: 'false'}]) {
        const client = server.connect(() => {});
        assert.throws(() => receive(server, client, {type: 'hello', protocol: P.version, buildId: BUILD, share: true, slots: 1, ...changes}));
    }
    const client = server.connect(() => {});
    assert.throws(() => receive(server, client, {type: 'submit', job: job(), claimed: [], cancelled: []}));
});

test('old and new bundles share concurrently with separate jobs, leases, and results', () => {
    const {server, join, submit, advance} = setup();
    const nextBuild = 'b'.repeat(64);
    const oldOwner = join(), oldHelper = join(), newOwner = join(1, nextBuild), newHelper = join(1, nextBuild);
    submit(oldOwner, job('same-id'));
    assert.equal(newHelper.client.leases.size, 0);
    submit(newOwner, job('same-id', {seed: 123}));
    assert.equal(server.jobs.size, 2);
    assert.equal(server.groups.size, 2);
    const oldWork = oldHelper.messages.find(message => message.type === 'work');
    const newWork = newHelper.messages.find(message => message.type === 'work');
    assert.equal(oldWork.job.seed, 42);
    assert.equal(newWork.job.seed, 123);
    receive(server, newHelper.client, {type: 'result', leaseId: oldWork.leaseId, report: report(oldWork.job, oldWork.index)});
    assert.equal(oldOwner.messages.filter(message => message.type === 'result').length, 0);
    for (const [helper, work] of [[oldHelper, oldWork], [newHelper, newWork]]) {
        receive(server, helper.client, {type: 'result', leaseId: work.leaseId, report: report(work.job, work.index)});
    }
    assert.equal(oldOwner.messages.find(message => message.type === 'result').report.seed, 42);
    assert.equal(newOwner.messages.find(message => message.type === 'result').report.seed, 123);
    advance();
    for (const participant of [oldOwner, oldHelper, newOwner, newHelper]) {
        assert.ok(participant.messages.every(message => message.buildId === participant.client.buildId));
    }
    server.disconnect(oldHelper.client);
    const reconnected = join();
    assert.equal(reconnected.messages.find(message => message.type === 'work').buildId, BUILD);
    server.disconnect(oldOwner.client);
    server.disconnect(reconnected.client);
    assert.equal(server.groups.has(BUILD), false);
    assert.equal(server.groups.get(nextBuild).jobs.size, 1);
    server.disconnect(newOwner.client);
    server.disconnect(newHelper.client);
    assert.equal(server.groups.size, 0);
    assert.equal(server.jobs.size, 0);
    assert.equal(server.leases.size, 0);
});

test('every version 2 request must keep its connection hash, before any state changes', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    submit(owner);
    const leaseId = [...helper.client.leases][0];
    for (const buildId of [undefined, 'b'.repeat(64), 'invalid']) {
        for (const message of [{type: 'mode', busy: true}, {type: 'abandon', cancelled: [leaseId]},
            {type: 'submit', job: job('new'), claimed: [], cancelled: [leaseId]}]) {
            assert.throws(() => server.receive(helper.client, {...message, buildId}), /hash/);
        }
    }
    assert.equal(helper.client.busy, false);
    assert.ok(server.leases.has(leaseId));
    assert.throws(() => receive(server, helper.client, {type: 'hello', protocol: P.version,
        buildId: 'b'.repeat(64), share: true, slots: 1}));
});

test('legacy handshakes cannot bypass mandatory hashes on every message', () => {
    const {server} = setup();
    const messages = [];
    const legacy = server.connect(message => messages.push(message));
    assert.throws(() => server.receive(legacy, {type: 'hello', protocol: 1, buildId: BUILD, share: true, slots: 1}));
    assert.equal(messages.length, 0);
    assert.equal(server.groups.size, 0);
    assert.throws(() => server.receive(legacy, {type: 'mode', busy: true}));
});

test('invalid cancellation, submit, and finish messages leave existing jobs and donations unchanged', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join(2);
    submit(owner);
    const leases = [...helper.client.leases];
    for (const invalid of [null, 42, '../invalid', '']) {
        assert.throws(() => receive(server, helper.client, {type: 'abandon', cancelled: [leases[0], invalid]}));
        assert.throws(() => submit(helper, job('new-job'), [0], [leases[0], invalid]));
        assert.deepEqual([...helper.client.leases], leases);
        assert.equal(helper.client.busy, false);
        assert.equal(server.jobs.size, 1);
    }
    assert.throws(() => receive(server, owner.client, {type: 'finish', jobId: 'job', busy: 'false'}));
    assert.equal(server.jobs.size, 1);
    assert.deepEqual([...helper.client.leases], leases);
});

test('the handshake reports its pool thread total, tracked across connects and disconnects', () => {
    const {server, join} = setup();
    const first = join(4);
    assert.equal(first.messages[0].type, 'ready');
    assert.equal(first.messages[0].networkThreads, 4);
    assert.equal(join(2).messages[0].networkThreads, 6);
    const other = join(3, 'b'.repeat(64));
    assert.equal(other.messages[0].networkThreads, 3, 'each bundle pool counts only its own participants');
    assert.equal(server.groups.get(BUILD).threads, 6);
    const unfinished = server.connect(() => {});
    server.disconnect(unfinished);
    assert.equal(server.groups.get(BUILD).threads, 6, 'a connection that never said hello contributes nothing');
    server.disconnect(first.client);
    assert.equal(server.groups.get(BUILD).threads, 2);
    server.disconnect(first.client);
    assert.equal(server.groups.get(BUILD).threads, 2, 'repeated cleanup cannot subtract the same capacity twice');
    assert.equal(join(5).messages[0].networkThreads, 7);
});

test('the pool total advertises capacity, so running a simulation does not shrink it', () => {
    const {server, join, submit} = setup();
    const owner = join(4);
    join(2);
    submit(owner);
    assert.equal(owner.client.slots, 0, 'the owner stops pulling while it pushes its own job');
    assert.equal(server.groups.get(BUILD).threads, 6);
    assert.equal(join(1).messages[0].networkThreads, 7);
});

test('a repeated socket cleanup cannot delete a newly recreated pool', () => {
    const {server, join} = setup();
    const disconnected = join();
    server.disconnect(disconnected.client);
    const replacement = join();
    server.disconnect(disconnected.client);
    assert.equal(server.groups.get(BUILD), replacement.client.group);
    assert.equal(server.clients.size, 1);
});

test('submit atomically preempts every donation and publishes the new job', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join(2), third = join();
    submit(owner);
    const abandoned = [...helper.client.leases];
    assert.equal(abandoned.length, 2);
    submit(helper, job('helper-job'), [0], abandoned);
    assert.equal(helper.client.busy, true);
    assert.equal(helper.client.leases.size, 0);
    assert.ok(abandoned.every(id => !server.leases.has(id)));
    assert.ok(server.groups.get(BUILD).jobs.has('helper-job'));
    receive(server, owner.client, {type: 'finish', jobId: 'job', busy: false});
    assert.ok(owner.messages.some(message => message.type === 'work' && message.job.id === 'helper-job'));
    assert.equal(third.client.leases.size, 1);
});

test('preemption also catches leases in transit that are absent from the cancellation list', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join(2);
    submit(owner);
    submit(helper, job('new'), [0], []);
    assert.equal(helper.client.leases.size, 0);
    assert.ok(server.groups.get(BUILD).jobs.get('job').chunks.includes('pending'));
});

test('claims revoke leases; stale, foreign, and duplicate results are ignored', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join(), stranger = join();
    submit(owner);
    const work = helper.messages.find(message => message.type === 'work');
    receive(server, stranger.client, {type: 'result', leaseId: work.leaseId, report: report(work.job, work.index)});
    assert.ok(server.leases.has(work.leaseId));
    receive(server, owner.client, {type: 'claim', jobId: 'job', index: work.index});
    receive(server, helper.client, {type: 'result', leaseId: work.leaseId, report: report(work.job, work.index)});
    assert.equal(owner.messages.filter(message => message.type === 'result').length, 0);
    const next = helper.messages.filter(message => message.type === 'work').at(-1);
    const result = {type: 'result', leaseId: next.leaseId, report: report(next.job, next.index)};
    receive(server, helper.client, result);
    receive(server, helper.client, result);
    assert.equal(owner.messages.filter(message => message.type === 'result').length, 1);
    assert.throws(() => receive(server, stranger.client, {type: 'claim', jobId: 'job', index: 0}), /belongs/);
});

test('expired leases receive new identities and old results cannot count twice', () => {
    const {server, join, submit, advance} = setup();
    const owner = join(), helper = join();
    submit(owner);
    const old = helper.messages.find(message => message.type === 'work');
    advance();
    assert.ok(!server.leases.has(old.leaseId));
    receive(server, helper.client, {type: 'result', leaseId: old.leaseId, report: report(old.job, old.index)});
    assert.equal(owner.messages.filter(message => message.type === 'result').length, 0);
    assert.ok(helper.messages.some(message => message.type === 'work' && message.leaseId !== old.leaseId));
});

test('disconnects requeue helper work and remove owner jobs', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    submit(owner);
    server.disconnect(helper.client);
    assert.equal(server.leases.size, 0);
    assert.equal(server.groups.get(BUILD).jobs.get('job').chunks.filter(value => value === 'pending').length, 4);
    const replacement = join();
    assert.equal(replacement.client.leases.size, 1);
    server.disconnect(owner.client);
    assert.equal(server.jobs.size, 0);
    assert.equal(server.leases.size, 0);
    assert.ok(replacement.messages.some(message => message.type === 'cancel'));
});

test('a busy client cannot pull until all its jobs finish, and then pulls immediately', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    submit(owner);
    submit(helper, job('second'));
    receive(server, helper.client, {type: 'mode', busy: false});
    assert.equal(helper.client.slots, 0);
    receive(server, helper.client, {type: 'finish', jobId: 'second', busy: false});
    assert.equal(helper.client.leases.size, 1);
});

test('bounded work and malformed numeric results are rejected before forwarding', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    assert.throws(() => submit(owner, job('huge', {iterations: 0xffffffff, chunkSize: 1})));
    assert.throws(() => submit(owner, job('overflow', {offset: 0xffffffff})));
    const unsafe = job(); unsafe.spec.player.auras = [{props: {dataLength: 1e9}}];
    assert.equal(P.job(unsafe), false);
    assert.equal(P.safeTree(JSON.parse('{"__proto__":{"polluted":true}}')), false);
    assert.equal(P.report({...report(job(), 0), player: {mh: {data: 'invalid'}}}, job(), 0), false);
    submit(owner);
    const work = helper.messages.find(message => message.type === 'work');
    assert.throws(() => receive(server, helper.client, {type: 'result', leaseId: work.leaseId,
        report: {...report(work.job, work.index), totaldmg: NaN}}), /Invalid result/);
    assert.equal(owner.messages.filter(message => message.type === 'result').length, 0);
});
