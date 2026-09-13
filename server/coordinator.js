'use strict';
const {randomUUID} = require('node:crypto');
const P = require('../js/compute-protocol');

class Coordinator {
    constructor({now = Date.now, leaseMs = P.leaseMs, maxClients = 512, maxJobs = 512} = {}) {
        this.now = now;
        this.leaseMs = leaseMs;
        this.maxClients = maxClients;
        this.maxJobs = maxJobs;
        this.clients = new Set();
        this.jobs = new Map();
        this.leases = new Map();
        this.groups = new Map();
    }
    connect(send) {
        if (this.clients.size >= this.maxClients) throw new Error('Coordinator is full');
        const client = {ready: false, slots: 0, busy: false, jobs: new Set(), leases: new Set()};
        client.send = message => send({...message, buildId: client.buildId});
        this.clients.add(client);
        return client;
    }
    receive(client, message) {
        if (!this.clients.has(client)) return;
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid message');
        if (message.type === 'hello') {
            if (client.ready || message.protocol !== P.version || !P.buildId(message.buildId) ||
                message.share !== true || !P.uint(message.slots, 1, 64) ||
                (message.busy !== undefined && typeof message.busy !== 'boolean')) throw new Error('Incompatible participant');
            Object.defineProperty(client, 'buildId', {value: message.buildId, enumerable: true});
            client.protocol = message.protocol;
            let group = this.groups.get(client.buildId);
            if (!group) {
                group = {clients: new Set(), jobs: new Map(), cursor: 0};
                this.groups.set(client.buildId, group);
            }
            client.group = group;
            group.clients.add(client);
            client.ready = true;
            client.capacity = message.slots;
            client.slots = message.busy ? 0 : message.slots;
            client.busy = !!message.busy;
            client.send({type: 'ready', protocol: client.protocol, leaseMs: this.leaseMs});
        } else {
            if (!client.ready) throw new Error('Join with sharing enabled first');
            if (message.buildId !== client.buildId) {
                throw new Error('Bundle hash does not match this connection');
            }
            switch (message.type) {
                case 'submit': {
                    const job = message.job;
                    if (!P.job(job) || client.group.jobs.has(job.id) || client.jobs.size >= 64 ||
                        this.jobs.size >= this.maxJobs || !Array.isArray(message.claimed) ||
                        message.claimed.length > P.maxChunks || !this.cancellations(message.cancelled)) {
                        throw new Error('Invalid or excessive job');
                    }
                    const count = Math.ceil(job.iterations / job.chunkSize);
                    if (!message.claimed.every(index => P.uint(index, 0, count - 1))) throw new Error('Invalid claims');
                    // Switching roles and requeuing ALL outstanding donations is one transaction.
                    // The explicit cancellation list is advisory: it can race with work in transit.
                    client.busy = true;
                    client.slots = 0;
                    for (const id of [...client.leases]) this.release(id);
                    const key = `${client.buildId}:${job.id}`;
                    const state = {key, job, owner: client, chunks: Array(count).fill('pending'), leases: new Map(), created: this.now()};
                    for (const index of message.claimed) state.chunks[index] = 'local';
                    this.jobs.set(key, state);
                    client.group.jobs.set(job.id, state);
                    client.jobs.add(key);
                    client.send({type: 'submitted', jobId: job.id});
                    break;
                }
                case 'claim': {
                    const state = this.owned(client, message.jobId);
                    if (!state) break;
                    if (!P.uint(message.index, 0, state.chunks.length - 1)) throw new Error('Invalid chunk');
                    const lease = state.leases.get(message.index);
                    if (lease) this.release(lease);
                    state.chunks[message.index] = 'local';
                    break;
                }
                case 'result': {
                    const lease = this.leases.get(message.leaseId);
                    if (!lease || lease.client !== client) break; // Expired, duplicate, or forged lease.
                    const state = lease.state;
                    if (lease.expires <= this.now()) { this.release(message.leaseId); break; }
                    if (!P.report(message.report, state.job, lease.index)) {
                        this.release(message.leaseId);
                        throw new Error('Invalid result');
                    }
                    this.release(message.leaseId, false);
                    state.chunks[lease.index] = 'done';
                    state.owner.send({type: 'result', jobId: lease.jobId, index: lease.index, report: message.report});
                    break;
                }
                case 'abandon': {
                    if (!this.cancellations(message.cancelled)) throw new Error('Invalid cancellations');
                    for (const id of message.cancelled) {
                        if (this.leases.get(id)?.client === client) this.release(id);
                    }
                    break;
                }
                case 'finish':
                    if (typeof message.busy !== 'boolean') throw new Error('Invalid mode');
                    if (this.owned(client, message.jobId)) this.removeJob(`${client.buildId}:${message.jobId}`);
                    this.mode(client, message);
                    break;
                case 'mode':
                    this.mode(client, message);
                    break;
                default: throw new Error('Unknown message');
            }
        }
        this.schedule();
    }
    cancellations(value) {
        return Array.isArray(value) && value.length <= 64 && value.every(id => P.id(id));
    }
    owned(client, id) {
        if (!P.id(id)) throw new Error('Invalid job ID');
        const state = client.group.jobs.get(id);
        if (state && state.owner !== client) throw new Error('Job belongs to another participant');
        return state;
    }
    mode(client, message) {
        if (typeof message.busy !== 'boolean') throw new Error('Invalid mode');
        client.busy = message.busy || client.jobs.size > 0;
        client.slots = client.busy ? 0 : client.capacity;
        if (client.busy) for (const id of [...client.leases]) this.release(id);
    }
    release(id, notify = true) {
        const lease = this.leases.get(id);
        if (!lease) return;
        this.leases.delete(id);
        lease.client.leases.delete(id);
        const state = this.jobs.get(lease.state.key);
        if (state) {
            state.leases.delete(lease.index);
            state.chunks[lease.index] = 'pending';
            if (notify) state.owner.send({type: 'released', jobId: lease.jobId, index: lease.index, leaseId: id});
        }
        if (notify) lease.client.send({type: 'cancel', leaseId: id});
    }
    removeJob(id) {
        const state = this.jobs.get(id);
        if (!state) return;
        for (const lease of [...state.leases.values()]) this.release(lease);
        state.owner.jobs.delete(id);
        state.owner.group.jobs.delete(state.job.id);
        this.jobs.delete(id);
    }
    disconnect(client) {
        if (!this.clients.delete(client)) return;
        for (const id of [...client.jobs]) this.removeJob(id);
        for (const id of [...client.leases]) this.release(id);
        if (client.group) {
            client.group.clients.delete(client);
            if (!client.group.clients.size) this.groups.delete(client.buildId);
        }
        this.schedule();
    }
    tick() {
        for (const [id, lease] of this.leases) if (lease.expires <= this.now()) this.release(id);
        for (const [id, state] of this.jobs) {
            if (this.now() - state.created > 30 * 60 * 1000) {
                state.owner.send({type: 'unavailable', jobId: state.job.id});
                this.removeJob(id);
            }
        }
        this.schedule();
    }
    schedule() {
        for (const client of this.clients) {
            if (!client.ready || client.busy) continue;
            const group = client.group;
            const jobs = [...group.jobs.values()];
            if (!jobs.length) continue;
            while (client.ready && !client.busy && client.leases.size < client.slots) {
                let state, index;
                for (let i = 0; i < jobs.length; i++) {
                    const candidate = jobs[group.cursor++ % jobs.length];
                    // Donate from the far end; owners compute from the beginning.
                    const pending = candidate.chunks.lastIndexOf('pending');
                    if (candidate.owner !== client && pending >= 0) { state = candidate; index = pending; break; }
                }
                if (!state) break;
                const id = randomUUID();
                this.leases.set(id, {client, state, jobId: state.job.id, index, expires: this.now() + this.leaseMs});
                client.leases.add(id);
                state.leases.set(index, id);
                state.chunks[index] = 'leased';
                state.owner.send({type: 'leased', jobId: state.job.id, index, leaseId: id});
                client.send({type: 'work', leaseId: id, job: state.job, index, leaseMs: this.leaseMs});
            }
        }
    }
}
module.exports = {Coordinator};
