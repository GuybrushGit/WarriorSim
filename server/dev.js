'use strict';
// Loopback-only preview of the static site and coordinator on one origin.
const fs = require('node:fs');
const path = require('node:path');
const {createServer} = require('./index');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8787);
const app = createServer({origins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`]});
const original = app.server.listeners('request')[0];
app.server.removeListener('request', original);
const types = {'.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
    '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json'};
app.server.on('request', (req, res) => {
    let url;
    try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (_) { res.writeHead(400).end(); return; }
    if (url === '/') url = '/index.html';
    if (!['/index.html', '/classic.html', '/favicon.ico'].includes(url) &&
        !url.startsWith('/dist/') && !url.startsWith('/css/')) { original(req, res); return; }
    const file = path.resolve(root, '.' + url);
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)] || !['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(403).end(); return;
    }
    fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
        res.writeHead(200, {'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store'});
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
});
app.server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/index.html`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.close().then(() => process.exit(0)));
