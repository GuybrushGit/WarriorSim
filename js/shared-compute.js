/* global ComputeProtocol, Player, SimulationWorkerParallel */
class SharedComputeClient {
    constructor({url, buildId, slots, workerUrl = './dist/js/compute-worker.min.js', onStatus = () => {}}) {
        if (!ComputeProtocol.buildId(buildId)) throw new Error('Invalid bundle hash');
        this.url = url;
        Object.defineProperty(this, 'buildId', {value: buildId, enumerable: true});
        this.workerUrl = workerUrl;
        this.slots = slots;
        this.onStatus = onStatus;
        this.enabled = false;
        this.uiBusy = false;
        this.runs = new Map();
        this.donations = new Map();
        this.idleWorkers = [];
        this.cancelled = [];
        this.retryDelay = 1000;
    }
    busy() { return this.uiBusy || this.runs.size > 0; }
    status() {
        this.onStatus(!this.enabled ? 'Off · local simulations only' :
            !this.ready ? 'Connecting · simulations run locally' :
            this.busy() ? 'Accelerating your simulations' :
            this.donations.size ? `Sharing compute · ${this.donations.size} workers` : 'Ready to share');
    }
    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (this.enabled) this.connect();
        else {
            clearTimeout(this.retryTimer);
            this.stopDonations();
            this.disconnect();
        }
        this.status();
    }
    send(message) {
        if (!this.ready || !this.socket || this.socket.readyState !== 1) return false;
        try {
            if (this.socket.bufferedAmount > ComputeProtocol.maxPayload * 4) throw new Error('Connection is congested');
            this.socket.send(JSON.stringify({...message, buildId: this.buildId}));
            return true;
        } catch (_) { this.socket.close(); return false; }
    }
    connect() {
        if (!this.enabled || this.socket) return;
        let socket;
        try { socket = new WebSocket(this.url); }
        catch (_) { this.reconnect(); return; }
        this.socket = socket;
        const timeout = setTimeout(() => { if (!this.ready && this.socket === socket) socket.close(); }, 5000);
        socket.onopen = () => {
            if (this.socket !== socket) return;
            socket.send(JSON.stringify({type: 'hello', protocol: ComputeProtocol.version,
                buildId: this.buildId, share: true, slots: this.slots, busy: this.busy()}));
        };
        socket.onmessage = event => {
            if (this.socket !== socket || !this.enabled) return;
            try {
                if (typeof event.data !== 'string' || event.data.length > ComputeProtocol.maxPayload) throw new Error('Invalid message');
                this.receive(JSON.parse(event.data));
            } catch (_) { socket.close(); }
        };
        socket.onerror = () => socket.close();
        socket.onclose = event => {
            clearTimeout(timeout);
            if (this.socket !== socket) return;
            this.socket = undefined;
            this.ready = false;
            this.stopDonations();
            this.cancelled = [];
            for (const run of this.runs.values()) run.detach();
            this.status();
            if (event.code === 1008) this.onStatus('Sharing unavailable · reload to check for updates');
            else this.reconnect();
        };
    }
    reconnect() {
        if (!this.enabled) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.connect(), this.retryDelay + Math.random() * 500);
        this.retryDelay = Math.min(30000, this.retryDelay * 2);
    }
    disconnect() {
        const socket = this.socket;
        this.socket = undefined;
        this.ready = false;
        if (socket) socket.close();
        this.cancelled = [];
        for (const run of this.runs.values()) run.detach();
    }
    receive(message) {
        if (message.buildId !== this.buildId) throw new Error('Message belongs to a different bundle');
        if (message.type === 'ready') {
            if (message.buildId !== this.buildId || message.protocol !== ComputeProtocol.version) throw new Error('Incompatible coordinator');
            this.ready = true;
            this.retryDelay = 1000;
            for (const run of this.runs.values()) run.attach();
        } else if (message.type === 'work') this.donate(message);
        else if (message.type === 'cancel') this.stopDonation(message.leaseId);
        else {
            const run = this.runs.get(message.jobId);
            if (run) run.receive(message);
        }
        this.status();
    }
    stopDonation(id) {
        const donation = this.donations.get(id);
        if (!donation) return;
        clearTimeout(donation.timeout);
        donation.worker.terminate(); // Synchronous reclamation, even inside a native runBatch.
        this.donations.delete(id);
    }
    stopDonations() {
        for (const id of this.donations.keys()) {
            this.cancelled.push(id);
            this.stopDonation(id);
        }
        for (const worker of this.idleWorkers) worker.terminate();
        this.idleWorkers = [];
    }
    beginForeground() {
        this.uiBusy = true;
        this.stopDonations(); // Keep these IDs for the atomic submit message.
        this.status();
    }
    endForeground() {
        this.uiBusy = false;
        if (this.cancelled.length) this.send({type: 'abandon', cancelled: this.cancelled.splice(0)});
        this.send({type: 'mode', busy: this.busy()});
        this.status();
    }
    add(run) {
        if (run.done) return;
        this.stopDonations();
        this.runs.set(run.job.id, run);
        run.attach();
        this.status();
    }
    remove(run) {
        this.runs.delete(run.job.id);
        if (run.attached) this.send({type: 'finish', jobId: run.job.id, busy: this.busy()});
        else this.send({type: 'mode', busy: this.busy()});
        this.status();
    }
    donate(message) {
        const reject = () => this.send({type: 'abandon', cancelled: [message.leaseId]});
        if (!this.enabled || this.busy() || this.donations.size >= this.slots) { reject(); return; }
        const job = message.job;
        if (!ComputeProtocol.id(message.leaseId) || !ComputeProtocol.job(job) ||
            !ComputeProtocol.uint(message.index, 0, Math.ceil(job.iterations / job.chunkSize) - 1) ||
            !ComputeProtocol.uint(message.leaseMs, 1, 60000)) throw new Error('Invalid work');
        const worker = this.idleWorkers.pop() || new Worker(this.workerUrl);
        const id = message.leaseId;
        const donation = {worker};
        this.donations.set(id, donation);
        donation.timeout = setTimeout(() => { this.stopDonation(id); reject(); this.status(); }, message.leaseMs);
        const fail = () => { this.stopDonation(id); reject(); this.status(); };
        worker.onerror = fail;
        worker.onmessage = ({data}) => {
            if (this.donations.get(id) !== donation || data.id !== id) return;
            if (data.error || !ComputeProtocol.report(data.report, job, message.index)) { fail(); return; }
            clearTimeout(donation.timeout);
            this.donations.delete(id);
            this.idleWorkers.push(worker);
            this.send({type: 'result', leaseId: id, report: data.report});
            this.status();
        };
        try {
            worker.postMessage({id, jobId: job.id, spec: job.spec, seed: job.seed,
                fullReport: job.fullReport, ...ComputeProtocol.range(job, message.index)});
        } catch (_) { fail(); }
    }
}

function resolveSharedSimulationSpec(params) {
    // Player construction adjusts item-spell options and some buff values. Local
    // workers isolate those writes; resolving a shared job must preserve that isolation.
    const catalogs = ['spells', 'buffs'].filter(name => Array.isArray(globalThis[name]));
    const originals = catalogs.map(name => globalThis[name]);
    try {
        catalogs.forEach((name, index) => { globalThis[name] = originals[index].map(value => ({...value})); });
        const args = params.player.slice();
        if (args[3]) args[3] = {...args[3], target: {...args[3].target}};
        const player = new Player(...args);
        if (!player.mh) throw new Error('No weapon selected');
        return player.serializeSimulationSpec(params.sim);
    } finally {
        catalogs.forEach((name, index) => { globalThis[name] = originals[index]; });
    }
}

class SharedSimulation {
    constructor(client, threads, finished, update, error) {
        this.client = client;
        this.threads = Math.max(1, Math.trunc(threads) || 1);
        this.finished = finished;
        this.update = update;
        this.error = error;
        this.workers = [];
        this.done = false;
    }
    start(params) {
        this.started = Date.now();
        this.client.stopDonations();
        try {
            params = normalizeSimulationWorkerParams(params);
            const spec = resolveSharedSimulationSpec(params);
            const chunkSize = Math.min(ComputeProtocol.maxChunkSize,
                Math.max(128, Math.ceil(params.sim.iterations / (this.threads * 16))));
            const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
            this.job = {id, spec,
                seed: params.sim.seed, iterations: params.sim.iterations, offset: params.sim.iterationOffset,
                fullReport: !!params.fullReport, chunkSize};
            // Unusual/very large configurations retain the established local execution path.
            if (!ComputeProtocol.job(this.job)) {
                this.client.stopDonations();
                this.client.runs.set(this.job.id, this);
                this.client.send({type: 'mode', busy: true});
                this.fallback = new SimulationWorkerParallel(this.threads, report => {
                    this.done = true;
                    this.cleanup();
                    this.finished(report);
                }, this.update, error => this.fail(error));
                this.fallback.start(params);
                return;
            }
            this.states = Array(Math.ceil(this.job.iterations / chunkSize)).fill('pending');
            this.remoteLeases = new Map();
            for (let i = 0; i < Math.min(this.threads, this.states.length); i++) {
                const slot = {worker: new Worker(this.client.workerUrl)};
                this.workers.push(slot);
                slot.worker.onerror = event => this.fail(event);
                slot.worker.onmessage = ({data}) => {
                    if (this.done || data.id !== String(slot.index)) return;
                    if (data.error) { this.fail(new Error(data.error)); return; }
                    const index = slot.index;
                    slot.index = undefined;
                    this.accept(index, data.report, true);
                    if (!this.done) this.fill(slot);
                };
                this.fill(slot);
                if (this.done) return;
            }
            this.client.add(this);
        } catch (error) { this.fail(error); }
    }
    attach() {
        if (this.done || this.fallback || this.attached || !this.client.enabled || !this.client.ready) return;
        const claimed = [];
        this.states.forEach((state, index) => { if (state === 'local' || state === 'done') claimed.push(index); });
        this.attached = this.client.send({type: 'submit', job: this.job, claimed,
            cancelled: this.client.cancelled.splice(0)});
    }
    detach() {
        this.attached = false;
        if (!this.states) return;
        this.remoteLeases.clear();
        this.states = this.states.map(state => state === 'remote' ? 'pending' : state);
    }
    fill(slot) {
        if (this.done) return;
        let index = this.states.indexOf('pending');
        // Tail stealing avoids waiting for a slow, frozen, or disconnected helper.
        if (index < 0) index = this.states.indexOf('remote');
        if (index < 0) return;
        this.states[index] = 'local';
        this.remoteLeases.delete(index);
        slot.index = index;
        if (this.attached) this.client.send({type: 'claim', jobId: this.job.id, index});
        try {
            slot.worker.postMessage({id: String(index), jobId: this.job.id, seed: this.job.seed,
                spec: this.job.spec, fullReport: this.job.fullReport, ...ComputeProtocol.range(this.job, index)});
        } catch (error) { this.fail(error); }
    }
    receive(message) {
        if (this.done || !this.attached) return;
        if (message.type === 'unavailable') { this.detach(); return; }
        if (!ComputeProtocol.uint(message.index, 0, this.states.length - 1)) return;
        const index = message.index;
        if (message.type === 'leased' && this.states[index] === 'pending') {
            this.states[index] = 'remote';
            this.remoteLeases.set(index, message.leaseId);
        } else if (message.type === 'released' && this.states[index] === 'remote' &&
            this.remoteLeases.get(index) === message.leaseId) {
            this.states[index] = 'pending';
            this.remoteLeases.delete(index);
        } else if (message.type === 'result' && this.states[index] !== 'local' && this.states[index] !== 'done') {
            if (ComputeProtocol.report(message.report, this.job, index)) this.accept(index, message.report, false);
            else { this.states[index] = 'pending'; this.remoteLeases.delete(index); }
        }
    }
    accept(index, report, local) {
        if (this.done || this.states[index] === 'done') return;
        if (local && !ComputeProtocol.report(report, this.job, index)) {
            this.fail(new Error('Invalid local WASM report'));
            return;
        }
        this.states[index] = 'done';
        this.remoteLeases.delete(index);
        this.report = mergeSimulationReports(this.report, report);
        if (this.report.iterations === this.job.iterations) {
            this.done = true;
            this.report.starttime = this.started;
            this.report.endtime = Date.now();
            this.cleanup();
            this.finished(this.report);
        } else this.update(this.report.iterations, {iterations: this.job.iterations,
            totaldmg: this.report.totaldmg, totalduration: this.report.totalduration});
    }
    cleanup() {
        for (const slot of this.workers) slot.worker.terminate();
        if (this.job && this.client.runs.has(this.job.id)) this.client.remove(this);
    }
    fail(error) {
        if (this.done) return;
        this.done = true;
        this.cleanup();
        this.error(error);
    }
    cancel() {
        this.done = true;
        if (this.fallback) this.fallback.cancel();
        this.cleanup();
    }
}

let sharedCompute;
function createSimulationRunner(threads, finished, update, error) {
    return sharedCompute && sharedCompute.enabled ?
        new SharedSimulation(sharedCompute, threads, finished, update, error) :
        new SimulationWorkerParallel(threads, finished, update, error);
}

function initSharedCompute() {
    const toggle = document.getElementById('share-compute');
    const status = document.getElementById('share-compute-status');
    if (!toggle || !status) return;
    const url = new URL('./compute', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    sharedCompute = new SharedComputeClient({url: url.href, buildId: globalThis.SIMULATOR_BUNDLE.buildId,
        workerUrl: globalThis.SIMULATOR_BUNDLE.workerUrl('js/compute-worker.min.js'),
        slots: Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2))),
        onStatus: value => { status.textContent = value; }});
    try { toggle.checked = localStorage.getItem('warriorsim.shareCompute') === 'true'; } catch (_) { /* Private browsing. */ }
    toggle.addEventListener('change', () => {
        try { localStorage.setItem('warriorsim.shareCompute', String(toggle.checked)); } catch (_) { /* Optional persistence. */ }
        sharedCompute.setEnabled(toggle.checked);
    });
    // Existing tabs must honor revocation too; opting in stays an explicit action per tab.
    window.addEventListener('storage', event => {
        if (event.key === 'warriorsim.shareCompute' && event.newValue !== 'true') {
            toggle.checked = false;
            sharedCompute.setEnabled(false);
        }
    });
    window.addEventListener('pagehide', () => {
        sharedCompute.setEnabled(false);
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            try { toggle.checked = localStorage.getItem('warriorsim.shareCompute') === 'true'; } catch (_) { toggle.checked = false; }
            sharedCompute.setEnabled(toggle.checked);
        }
    });
    sharedCompute.setEnabled(toggle.checked);
}
