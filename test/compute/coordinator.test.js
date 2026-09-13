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
    assert.equal(first.messages[0].networkThreads, 0, 'the first participant has no peers to count');
    assert.equal(join(2).messages[0].networkThreads, 4, 'peers only, so the joiner omits its own capacity');
    const other = join(3, 'b'.repeat(64));
    assert.equal(other.messages[0].networkThreads, 0, 'each bundle pool counts only its own participants');
    assert.equal(server.groups.get(BUILD).threads, 6);
    const unfinished = server.connect(() => {});
    server.disconnect(unfinished);
    assert.equal(server.groups.get(BUILD).threads, 6, 'a connection that never said hello contributes nothing');
    server.disconnect(first.client);
    assert.equal(server.groups.get(BUILD).threads, 2);
    server.disconnect(first.client);
    assert.equal(server.groups.get(BUILD).threads, 2, 'repeated cleanup cannot subtract the same capacity twice');
    assert.equal(join(5).messages[0].networkThreads, 2, 'the survivors, not the newcomer, make up the peer total');
});

test('the pool total advertises capacity, so running a simulation does not shrink it', () => {
    const {server, join, submit} = setup();
    const owner = join(4);
    join(2);
    submit(owner);
    assert.equal(owner.client.slots, 0, 'the owner stops pulling while it pushes its own job');
    assert.equal(server.groups.get(BUILD).threads, 6);
    assert.equal(join(1).messages[0].networkThreads, 6, 'the busy owner still counts toward what a peer sees');
});

test('a mode message can re-advertise capacity without reconnecting', () => {
    const {server, join, submit} = setup();
    const owner = join(1), helper = join(2);
    assert.equal(server.groups.get(BUILD).threads, 3);
    receive(server, helper.client, {type: 'mode', busy: false, slots: 6});
    assert.equal(helper.client.capacity, 6);
    assert.equal(helper.client.slots, 6);
    assert.equal(server.groups.get(BUILD).threads, 7, 'the pool total follows the new capacity');
    submit(owner);
    // Capacity 6 now exceeds the work: every chunk the owner did not claim is leased at once,
    // where the original capacity of 2 would have covered only two of them.
    assert.equal(helper.client.leases.size, 4, 'the extra capacity is scheduled immediately');
    receive(server, helper.client, {type: 'mode', busy: false, slots: 2});
    assert.equal(server.groups.get(BUILD).threads, 3);
    // Leases beyond the new capacity drain rather than being torn down mid-batch.
    assert.equal(helper.client.leases.size, 4);
    server.disconnect(helper.client);
    assert.equal(server.groups.get(BUILD).threads, 1, 'the reduced capacity is what gets removed');
});

test('an invalid re-advertised capacity is rejected before it can skew the pool total', () => {
    const {server, join} = setup();
    const client = join(3);
    for (const slots of [0, 65, 1.5, '4', null]) {
        assert.throws(() => receive(server, client.client, {type: 'mode', busy: false, slots}), /capacity/);
    }
    assert.equal(client.client.capacity, 3);
    assert.equal(server.groups.get(BUILD).threads, 3);
    receive(server, client.client, {type: 'mode', busy: false});
    assert.equal(client.client.capacity, 3, 'omitting slots leaves capacity alone');
    assert.equal(server.groups.get(BUILD).threads, 3);
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
    const result = {type: 'result', leaseId: next.leaseId, report: report(job(), next.index)};
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

test('a participant may keep more leases outstanding than threads, within the cap', () => {
    const {server, join, submit} = setup();
    const owner = join();
    const messages = [];
    const helper = server.connect(message => messages.push(message));
    for (const queue of [1, 9, 300, 2.5, '4', null]) {
        assert.throws(() => receive(server, helper, {type: 'hello', protocol: P.version, buildId: BUILD, share: true, slots: 2, queue}));
    }
    assert.equal(P.queue(256, 64), true);
    assert.equal(P.queue(257, 64), false, 'four per thread, and never more than the protocol cap');
    receive(server, helper, {type: 'hello', protocol: P.version, buildId: BUILD, share: true, slots: 2, queue: 6});
    assert.equal(server.groups.get(BUILD).threads, 3, 'the pool counts threads, not queued leases');
    submit(owner, job('big', {iterations: 128 * 20}));
    assert.equal(helper.leases.size, 6, 'leases fill the queue, not just the threads');
    for (const queue of [1, 9, 257]) assert.throws(() => receive(server, helper, {type: 'mode', busy: false, queue}), /queue/);
    assert.equal(helper.leases.size, 6);
    receive(server, helper, {type: 'mode', busy: false, queue: 8});
    assert.equal(helper.leases.size, 8, 'a deeper queue is filled immediately');
    receive(server, helper, {type: 'mode', busy: false, slots: 4});
    assert.equal(helper.queue, 4, 'a new thread count without a queue resets the queue to it');
    assert.equal(helper.leases.size, 8, 'leases beyond the new queue drain rather than being torn down');
    receive(server, helper, {type: 'mode', busy: false, slots: 3, queue: 12});
    assert.equal(helper.leases.size, 12);
    assert.equal(server.groups.get(BUILD).threads, 4);
    receive(server, helper, {type: 'mode', busy: true});
    assert.equal(helper.leases.size, 0);
    receive(server, helper, {type: 'mode', busy: false});
    assert.equal(helper.leases.size, 12, 'the queue survives a round trip through push mode');
});

test('leases spread across participants one at a time, so a deep queue cannot hoard a small job', () => {
    const {server, join, submit} = setup();
    const owner = join(), first = join(), second = join();
    receive(server, first.client, {type: 'mode', busy: false, queue: 4});
    receive(server, second.client, {type: 'mode', busy: false, queue: 4});
    submit(owner);
    assert.equal(first.client.leases.size, 2);
    assert.equal(second.client.leases.size, 2);
    const late = join();
    receive(server, late.client, {type: 'mode', busy: false, queue: 4});
    assert.equal(late.client.leases.size, 0, 'nothing is torn down to make room for a newcomer');
});

test('the spec travels once per job per connection and is forgotten with the job', () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    receive(server, helper.client, {type: 'mode', busy: false, queue: 3});
    submit(owner);
    const works = () => helper.messages.filter(message => message.type === 'work');
    assert.deepEqual(works().map(message => [message.jobId, 'job' in message]), [['job', true], ['job', false], ['job', false]]);
    assert.ok(works().every(message => P.id(message.leaseId) && P.uint(message.index) && message.leaseMs === 1000));
    const other = join();
    submit(other, job('other'));
    for (let round = 0; round < 4; round++) {
        const oldest = works()[round];
        receive(server, helper.client, {type: 'result', leaseId: oldest.leaseId, report: report(job(), oldest.index)});
    }
    for (const id of ['job', 'other']) {
        const carried = works().filter(message => message.jobId === id).map(message => 'job' in message);
        assert.ok(carried.length > 1, `${id} was leased more than once`);
        assert.deepEqual(carried, [true, ...carried.slice(1).map(() => false)], `${id} carried its spec exactly once`);
    }
    const bystander = [];
    receive(server, server.connect(message => bystander.push(message)),
        {type: 'hello', protocol: P.version, buildId: BUILD, share: true, slots: 1, busy: true});
    receive(server, owner.client, {type: 'finish', jobId: 'job', busy: false});
    assert.ok(helper.messages.some(message => message.type === 'forget' && message.jobId === 'job'));
    assert.equal(helper.client.sent.has(`${BUILD}:job`), false);
    assert.equal(bystander.some(message => message.type === 'forget'), false, 'only holders of the spec are told');
    receive(server, other.client, {type: 'finish', jobId: 'other', busy: false});
    const before = works().length;
    submit(owner, job('job', {seed: 7}));
    const resubmitted = works().slice(before);
    assert.ok(resubmitted.length > 1);
    assert.equal(resubmitted[0].job.seed, 7, 'a resubmitted ID is a new job with a fresh spec');
    assert.ok(resubmitted.slice(1).every(message => !('job' in message)));
    server.disconnect(helper.client);
    const fresh = join();
    assert.ok(fresh.messages.find(message => message.type === 'work').job, 'a new connection starts without specs');
    server.disconnect(owner.client);
    assert.ok(fresh.messages.some(message => message.type === 'forget' && message.jobId === 'job'));
});

test("a result's send time is echoed on the helper's next lease", () => {
    const {server, join, submit} = setup();
    const owner = join(), helper = join();
    submit(owner);
    const first = helper.messages.find(message => message.type === 'work');
    assert.equal(first.echo, undefined, 'nothing to echo before the first result');
    for (const sent of [-1, 1.5, '12', Number.MAX_SAFE_INTEGER + 2]) {
        assert.throws(() => receive(server, helper.client, {type: 'result', leaseId: first.leaseId, sent,
            report: report(job(), first.index)}), /Invalid result/);
    }
    assert.ok(server.leases.has(first.leaseId));
    receive(server, helper.client, {type: 'result', leaseId: first.leaseId, sent: 1234, report: report(job(), first.index)});
    const next = helper.messages.filter(message => message.type === 'work').at(-1);
    assert.notEqual(next.leaseId, first.leaseId);
    assert.equal(next.echo, 1234);
    receive(server, helper.client, {type: 'result', leaseId: 'expired-or-forged', sent: 5678, report: report(job(), 0)});
    receive(server, owner.client, {type: 'claim', jobId: 'job', index: next.index});
    const after = helper.messages.filter(message => message.type === 'work').at(-1);
    assert.equal(after.echo, 5678, 'any received result updates the echo, even one that no longer counts');
});
