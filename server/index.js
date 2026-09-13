'use strict';
const http = require('node:http');
const {timingSafeEqual} = require('node:crypto');
const {WebSocketServer, WebSocket} = require('ws');
const {Coordinator} = require('./coordinator');
const P = require('../js/compute-protocol');

function createServer({origins = [], workerToken = '', ...options}) {
    const coordinator = new Coordinator(options);
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/healthz') res.end(JSON.stringify({ok: true, participants: coordinator.clients.size,
            jobs: coordinator.jobs.size, groups: coordinator.groups.size}));
        else { res.statusCode = 404; res.end('{}'); }
    });
    const wss = new WebSocketServer({noServer: true, maxPayload: P.maxPayload, perMessageDeflate: false});
    server.on('upgrade', (req, socket, head) => {
        const token = Buffer.from(req.headers.authorization || '');
        const expected = Buffer.from(`Bearer ${workerToken}`);
        const native = !req.headers.origin && workerToken && token.length === expected.length && timingSafeEqual(token, expected);
        if (req.url !== '/compute' || (!native && !origins.includes(req.headers.origin)) ||
            coordinator.clients.size >= coordinator.maxClients) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
    });
    wss.on('connection', ws => {
        let alive = true, messages = 0, bytes = 0, windowStart = Date.now();
        const client = coordinator.connect(message => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (ws.bufferedAmount > 4 * P.maxPayload) { ws.terminate(); return; }
            ws.send(JSON.stringify(message));
        });
        const handshake = setTimeout(() => { if (!client.ready) ws.terminate(); }, 5000);
        ws.on('message', (data, binary) => {
            try {
                if (Date.now() - windowStart >= 1000) { messages = 0; bytes = 0; windowStart = Date.now(); }
                bytes += data.length;
                if (binary || ++messages > 2000 || bytes > 16 * P.maxPayload) throw new Error('Message limit exceeded');
                coordinator.receive(client, JSON.parse(data.toString()));
            } catch (_) {
                coordinator.disconnect(client);
                ws.close(1008, 'Invalid protocol message or incompatible build');
            }
        });
        ws.on('pong', () => { alive = true; });
        const heartbeat = setInterval(() => {
            if (!alive) ws.terminate();
            else { alive = false; ws.ping(); }
        }, 30000);
        ws.on('error', () => ws.terminate());
        ws.on('close', () => {
            clearTimeout(handshake);
            clearInterval(heartbeat);
            coordinator.disconnect(client);
        });
    });
    const sweep = setInterval(() => coordinator.tick(), 1000);
    return {server, coordinator, close: () => new Promise(resolve => {
        clearInterval(sweep);
        for (const ws of wss.clients) ws.terminate();
        wss.close(() => server.close(resolve));
    })};
}

if (require.main === module) {
    const origins = (process.env.COMPUTE_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!origins.length) throw new Error('Set COMPUTE_ORIGINS to the exact HTTPS site origin(s)');
    const app = createServer({origins, workerToken: process.env.COMPUTE_WORKER_TOKEN || ''});
    app.server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => {
        console.log(`Compute coordinator listening on ${JSON.stringify(app.server.address())}`);
    });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.close().then(() => process.exit(0)));
}
module.exports = {createServer};
