/* global ComputeProtocol, Player, SimulationWorkerParallel */
// Enough round-trip samples to follow a changing connection within a couple of seconds of
// donation at typical thread counts, and enough chunk samples to shrug off a single
// garbage-collection pause.
const RTT_SAMPLES = 32;
const CHUNK_SAMPLES = 16;
const MAX_SAMPLE_MS = 60000;
// Headroom over the measured need, the relative change worth telling the coordinator
// about, and the shortest interval between two such updates.
const QUEUE_MARGIN = 1.25;
const QUEUE_HYSTERESIS = 0.25;
const QUEUE_PUBLISH_INTERVAL_MS = 1000;

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

class SharedComputeClient {
    constructor({url, buildId, slots, workerUrl = './dist/js/compute-worker.min.js',
        onStatus = () => {}, onThreads = () => {},
        now = () => (typeof performance === 'object' ? performance.now() : Date.now())}) {
        if (!ComputeProtocol.buildId(buildId)) throw new Error('Invalid bundle hash');
        this.url = url;
        Object.defineProperty(this, 'buildId', {value: buildId, enumerable: true});
        this.workerUrl = workerUrl;
        this.now = now;
        this.slots = slots;
        // What the coordinator was last told; the difference is what publish must send.
        this.publishedSlots = slots;
        this.onStatus = onStatus;
        this.onThreads = onThreads;
        // Capacity of everyone else in the pool as of the last handshake, excluding our own
        // shared threads; undefined until a coordinator reports one.
        this.networkThreads = undefined;
        this.enabled = false;
        this.uiBusy = false;
        this.runs = new Map();
        this.leaseMs = ComputeProtocol.leaseMs;
        // Round trips to the coordinator and our own compute time per chunk, most recent last.
        this.samples = {rtt: [], chunk: []};
        // Leases the coordinator may keep with us: the ones running plus enough waiting
        // behind them that no worker idles for a round trip between chunks.
        this.queue = this.queueFor(slots);
        this.publishedQueue = this.queue;
        this.lastQueuePublish = -Infinity;
        // Specs received on this connection, by job ID; later leases name the job only.
        this.jobs = new Map();
        // Lease ID to donation. Those without a worker wait in order in `waiting`.
        this.donations = new Map();
        this.waiting = [];
        this.active = 0;
        this.idleWorkers = [];
        this.cancelled = [];
        this.retryDelay = 1000;
    }
    busy() { return this.uiBusy || this.runs.size > 0; }
    status() {
        this.onThreads({enabled: this.enabled, shared: this.slots, network: this.networkThreads});
        const waiting = this.waiting.length ? ` · ${this.waiting.length} queued` : '';
        this.onStatus(!this.enabled ? 'Off · local simulations only' :
            !this.ready ? 'Connecting · simulations run locally' :
            this.busy() ? 'Accelerating your simulations' :
            this.donations.size ? `Sharing compute · ${this.active} workers${waiting}` : 'Ready to share');
    }
    setSlots(slots) {
        this.slots = slots;
        this.queue = this.queueFor(slots);
        this.status();
    }
    sample(kind, value) {
        if (!(value >= 0 && value <= MAX_SAMPLE_MS)) return;
        const values = this.samples[kind];
        values.push(value);
        if (values.length > (kind === 'rtt' ? RTT_SAMPLES : CHUNK_SAMPLES)) values.shift();
    }
    // Little's law: a lease turns around in one round trip plus one chunk, so a worker stays
    // busy when its share of the outstanding leases covers that turnaround. Round trips are
    // taken at their minimum, since every sample is a true round trip plus some slack; chunk
    // times at their median. Twice the thread count until both have been measured.
    queueFor(slots) {
        const cap = Math.min(4 * slots, ComputeProtocol.maxQueue);
        if (!this.samples.rtt.length || !this.samples.chunk.length) return Math.min(cap, 2 * slots);
        const rtt = Math.min(...this.samples.rtt), chunk = Math.max(1, median(this.samples.chunk));
        let queue = Math.ceil(slots * (1 + rtt / chunk) * QUEUE_MARGIN);
        // Waiting work must still start well inside its lease when chunks are slow here.
        queue = Math.min(queue, Math.floor(slots * this.leaseMs / (2 * chunk)));
        return Math.max(slots, Math.min(cap, queue));
    }
    adapt() {
        this.queue = this.queueFor(this.slots);
        // Judged against what the coordinator knows, so an update held back by the interval
        // still goes out once it has passed.
        if (Math.abs(this.queue - this.publishedQueue) < Math.max(1, this.publishedQueue * QUEUE_HYSTERESIS) ||
            this.now() - this.lastQueuePublish < QUEUE_PUBLISH_INTERVAL_MS) return;
        this.publish();
    }
    publish() {
        if (!this.ready) return;
        this.queue = this.queueFor(this.slots);
        if (this.slots === this.publishedSlots && this.queue === this.publishedQueue) return;
        // The pool figure counts peers only, so our own change never moves it.
        if (this.send({type: 'mode', busy: this.busy(), slots: this.slots, queue: this.queue})) {
            this.publishedSlots = this.slots;
            this.publishedQueue = this.queue;
            this.lastQueuePublish = this.now();
        }
        this.status();
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
            this.publishedSlots = this.slots;
            this.queue = this.queueFor(this.slots);
            this.publishedQueue = this.queue;
            this.helloAt = this.now();
            socket.send(JSON.stringify({type: 'hello', protocol: ComputeProtocol.version,
                buildId: this.buildId, share: true, slots: this.slots, queue: this.queue, busy: this.busy()}));
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
            this.jobs.clear();
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
        this.jobs.clear();
        this.cancelled = [];
        for (const run of this.runs.values()) run.detach();
    }
    receive(message) {
        if (message.buildId !== this.buildId) throw new Error('Message belongs to a different bundle');
        if (message.type === 'ready') {
            if (message.buildId !== this.buildId || message.protocol !== ComputeProtocol.version) throw new Error('Incompatible coordinator');
            this.ready = true;
            // Optional: a coordinator that predates pool reporting simply leaves the row unknown.
            this.networkThreads = ComputeProtocol.uint(message.networkThreads, 0) ? message.networkThreads : undefined;
            this.leaseMs = ComputeProtocol.uint(message.leaseMs, 1, 60000) ? message.leaseMs : ComputeProtocol.leaseMs;
            this.sample('rtt', this.now() - this.helloAt);
            this.retryDelay = 1000;
            for (const run of this.runs.values()) run.attach();
        } else if (message.type === 'work') this.donate(message);
        else if (message.type === 'cancel') this.stopDonation(message.leaseId);
        else if (message.type === 'forget') {
            if (ComputeProtocol.id(message.jobId)) this.jobs.delete(message.jobId);
        } else {
            const run = this.runs.get(message.jobId);
            if (run) run.receive(message);
        }
        this.status();
    }
    stopDonation(id) {
        const donation = this.donations.get(id);
        if (!donation) return;
        clearTimeout(donation.timeout);
        this.donations.delete(id);
        if (donation.worker) {
            donation.worker.terminate(); // Synchronous reclamation, even inside a native runBatch.
            this.active--;
            this.pump();
        } else {
            // Waiting work stops for free: no worker started it.
            const at = this.waiting.indexOf(id);
            if (at >= 0) this.waiting.splice(at, 1);
        }
    }
    stopDonations() {
        // Drop the waiting leases first, so terminating a worker does not start another one.
        const ids = [...this.donations.keys()];
        this.waiting = [];
        for (const id of ids) {
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
        if (!ComputeProtocol.id(message.leaseId) || !ComputeProtocol.id(message.jobId) ||
            !ComputeProtocol.uint(message.leaseMs, 1, 60000) ||
            (message.echo !== undefined && !ComputeProtocol.uint(message.echo, 0, Number.MAX_SAFE_INTEGER))) {
            throw new Error('Invalid work');
        }
        // Our own send time for an earlier result, echoed back: one round trip plus whatever
        // the coordinator waited before granting this lease.
        if (message.echo !== undefined) this.sample('rtt', this.now() - message.echo);
        let job = this.jobs.get(message.jobId);
        if (message.job !== undefined) {
            if (!ComputeProtocol.job(message.job) || message.job.id !== message.jobId) throw new Error('Invalid work');
            job = message.job;
            this.jobs.set(job.id, job);
        }
        if (!job) throw new Error('Unknown job');
        if (!ComputeProtocol.uint(message.index, 0, Math.ceil(job.iterations / job.chunkSize) - 1)) throw new Error('Invalid work');
        const id = message.leaseId;
        const reject = () => this.send({type: 'abandon', cancelled: [id]});
        if (!this.enabled || this.busy() || this.donations.size >= Math.min(4 * this.slots, ComputeProtocol.maxQueue)) {
            reject();
            return;
        }
        const donation = {job, index: message.index, reject};
        this.donations.set(id, donation);
        donation.timeout = setTimeout(() => { this.stopDonation(id); reject(); this.status(); }, message.leaseMs);
        this.waiting.push(id);
        this.pump();
    }
    pump() {
        while (this.waiting.length && this.active < this.slots) {
            const id = this.waiting.shift();
            const donation = this.donations.get(id);
            const worker = this.idleWorkers.pop() || new Worker(this.workerUrl);
            donation.worker = worker;
            donation.started = this.now();
            this.active++;
            const fail = () => { this.stopDonation(id); donation.reject(); this.status(); };
            worker.onerror = fail;
            worker.onmessage = ({data}) => {
                if (this.donations.get(id) !== donation || data.id !== id) return;
                if (data.error || !ComputeProtocol.report(data.report, donation.job, donation.index)) { fail(); return; }
                this.finish(id, data.report);
            };
            try {
                worker.postMessage({id, jobId: donation.job.id, spec: donation.job.spec, seed: donation.job.seed,
                    fullReport: donation.job.fullReport, ...ComputeProtocol.range(donation.job, donation.index)});
            } catch (_) { fail(); }
        }
    }
    finish(id, report) {
        const donation = this.donations.get(id);
        clearTimeout(donation.timeout);
        this.donations.delete(id);
        this.active--;
        this.idleWorkers.push(donation.worker);
        this.sample('chunk', this.now() - donation.started);
        this.send({type: 'result', leaseId: id, report, sent: Math.floor(this.now())});
        this.pump();
        this.adapt();
        this.status();
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
            // A few chunks per local worker: large enough that a donor's compute dwarfs the
            // round trip delivering each one, small enough for the tail to balance.
            const chunkSize = Math.min(ComputeProtocol.maxChunkSize,
                Math.max(128, Math.ceil(params.sim.iterations / (this.threads * 4))));
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

const SHARE_COMPUTE_KEY = 'warriorsim.shareCompute';
const LOCAL_THREADS_KEY = 'warriorsim.localThreads';
const SHARED_THREADS_KEY = 'warriorsim.sharedThreads';
const SHARED_THREADS_MIN = 2;
const SHARED_THREADS_RATIO = 0.45;

// Sharing is opt-out: only an explicit refusal from an earlier visit turns it off,
// so a first visit and unreadable storage both keep the default on.
function readShareComputePreference() {
    try { return localStorage.getItem(SHARE_COMPUTE_KEY) !== 'false'; } catch (_) { return true; }
}
function readStoredThreads(key, min, max, fallback) {
    let stored;
    try { stored = parseInt(localStorage.getItem(key), 10); } catch (_) { /* Private browsing. */ }
    // Always re-clamp: a stored count can come from a machine with a different CPU.
    return Math.min(max, Math.max(min, Number.isFinite(stored) ? stored : fallback));
}
function storeThreads(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* Optional persistence. */ }
}

let localThreadCount = 0;
// The simulator's own worker count once the panel has resolved its stored preference.
// Zero beforehand, so callers fall back to their own hardware default.
function sharedComputeLocalThreads() { return localThreadCount; }

function initSharedCompute(maxThreads) {
    const toggle = document.getElementById('share-compute');
    const status = document.getElementById('share-compute-status');
    if (!toggle || !status) return;
    const localMax = ComputeProtocol.uint(maxThreads, 1) ? maxThreads : (navigator.hardwareConcurrency || 4);
    // A single-core machine still has to satisfy the shared floor, so clamp rather than invert.
    const sharedMax = Math.max(SHARED_THREADS_MIN, localMax);
    localThreadCount = readStoredThreads(LOCAL_THREADS_KEY, 1, localMax, localMax);
    const sharedThreads = readStoredThreads(SHARED_THREADS_KEY, SHARED_THREADS_MIN, sharedMax,
        Math.floor(sharedMax * SHARED_THREADS_RATIO));
    const entries = {};
    for (const entry of document.querySelectorAll('.share-compute-entry[data-threads]')) {
        entries[entry.dataset.threads] = entry;
    }
    const count = value => ComputeProtocol.uint(value, 0) ? `${value} thread${value === 1 ? '' : 's'}` : '—';
    const write = (name, value, active) => {
        const entry = entries[name];
        if (!entry) return;
        const cell = entry.querySelector('.share-compute-row').lastElementChild;
        const text = count(value);
        if (cell.textContent !== text) cell.textContent = text;
        entry.classList.toggle('share-compute-idle', !active);
    };
    const slider = (name, min, max, value) => {
        const input = entries[name] && entries[name].querySelector('input[type="range"]');
        if (!input) return undefined;
        input.min = String(min);
        input.max = String(max);
        input.value = String(value);
        input.disabled = min >= max; // Nothing to choose between.
        return input;
    };
    const url = new URL('./compute', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    sharedCompute = new SharedComputeClient({url: url.href, buildId: globalThis.SIMULATOR_BUNDLE.buildId,
        workerUrl: globalThis.SIMULATOR_BUNDLE.workerUrl('js/compute-worker.min.js'),
        slots: sharedThreads,
        onStatus: value => { status.textContent = value; },
        onThreads: ({enabled, shared, network}) => {
            // Local workers run every simulation, shared or not, so that row never dims.
            write('local', localThreadCount, true);
            write('network', network, enabled);
            write('shared', shared, enabled);
        }});
    const localSlider = slider('local', 1, localMax, localThreadCount);
    if (localSlider) {
        localSlider.addEventListener('input', () => {
            localThreadCount = Number(localSlider.value);
            sharedCompute.status();
        });
        localSlider.addEventListener('change', () => storeThreads(LOCAL_THREADS_KEY, localThreadCount));
    }
    const sharedSlider = slider('shared', SHARED_THREADS_MIN, sharedMax, sharedThreads);
    if (sharedSlider) {
        // Track the drag locally, but only tell the coordinator once it settles.
        sharedSlider.addEventListener('input', () => sharedCompute.setSlots(Number(sharedSlider.value)));
        sharedSlider.addEventListener('change', () => {
            storeThreads(SHARED_THREADS_KEY, sharedCompute.slots);
            sharedCompute.publish();
        });
    }
    toggle.checked = readShareComputePreference();
    toggle.addEventListener('change', () => {
        try { localStorage.setItem(SHARE_COMPUTE_KEY, String(toggle.checked)); } catch (_) { /* Optional persistence. */ }
        sharedCompute.setEnabled(toggle.checked);
    });
    // Existing tabs must honor revocation too; opting back in stays an explicit action per tab.
    window.addEventListener('storage', event => {
        if (event.key === SHARE_COMPUTE_KEY && event.newValue === 'false') {
            toggle.checked = false;
            sharedCompute.setEnabled(false);
        }
    });
    window.addEventListener('pagehide', () => {
        sharedCompute.setEnabled(false);
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            toggle.checked = readShareComputePreference();
            sharedCompute.setEnabled(toggle.checked);
        }
    });
    sharedCompute.setEnabled(toggle.checked);
}
