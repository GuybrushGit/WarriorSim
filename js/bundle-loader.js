/* Preload one complete release and retain its assets until the document is unloaded. */
(function() {
    'use strict';
    const manifestUrl = new URL('../compute-build.json', document.currentScript.src);
    const hex = buffer => Array.from(new Uint8Array(buffer), value => value.toString(16).padStart(2, '0')).join('');
    const objectUrls = [];
    const retain = (bytes, type) => {
        const url = URL.createObjectURL(new Blob([bytes], {type}));
        objectUrls.push(url);
        return url;
    };
    globalThis.simulatorReady = (async () => {
        const response = await fetch(manifestUrl, {cache: 'no-store'});
        if (!response.ok) throw new Error('Could not load the simulation bundle');
        const manifest = await response.json();
        if (manifest.format !== 2 || !Number.isInteger(manifest.protocol) || manifest.specVersion !== 1 ||
            !manifest.entrypoints || !Array.isArray(manifest.files) || manifest.files.length > 256) {
            throw new Error('Unsupported simulation bundle manifest');
        }
        const files = manifest.files.map(file => {
            if (!file || !/^(js|wasm)\/[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.includes('..') ||
                !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid simulation asset');
            return {path: file.path, sha256: file.sha256};
        }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
        const byPath = new Map(files.map(file => [file.path, file.sha256]));
        if (byPath.size !== files.length) throw new Error('Duplicate simulation asset');
        const entrypoints = {};
        for (const mode of ['classic', 'sod']) {
            const list = manifest.entrypoints[mode];
            if (!Array.isArray(list) || !list.length || list.length > 128 ||
                !list.every(file => byPath.has(file) && file.startsWith('js/'))) throw new Error('Invalid entrypoint');
            entrypoints[mode] = list;
        }
        const descriptor = {format: 2, protocol: manifest.protocol, specVersion: 1, entrypoints, files};
        const buildId = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(descriptor))));
        if (buildId !== manifest.buildId) throw new Error('Simulation bundle hash mismatch');
        const selected = entrypoints[globalThis.mode];
        if (!selected) throw new Error('Unknown simulator mode');
        const base = new URL(`./bundles/${buildId}/`, manifestUrl);
        // Complete and verify every download before executing any application code.
        // Object URLs retain the bytes independently of HTTP cache eviction or deployment.
        const contents = await Promise.all(files.map(async file => {
            const response = await fetch(new URL(file.path, base));
            if (!response.ok) throw new Error(`Could not preload bundle asset: ${file.path}`);
            const bytes = await response.arrayBuffer();
            if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256) {
                throw new Error(`Bundle asset hash mismatch: ${file.path}`);
            }
            return bytes;
        }));
        const assets = new Map(files.map((file, index) => [file.path, retain(contents[index],
            file.path.endsWith('.wasm') ? 'application/wasm' :
            file.path.endsWith('.json') ? 'application/json' : 'text/javascript')]));
        const assetUrl = file => {
            if (!assets.has(file)) throw new Error(`Asset is outside the selected bundle: ${file}`);
            return assets.get(file);
        };
        const workers = new Map();
        for (const entry of ['js/sim-worker.min.js', 'js/compute-worker.min.js']) {
            assetUrl(entry);
            const bootstrap = `(() => {
                const assets = new Map(${JSON.stringify([...assets])});
                Object.defineProperty(globalThis, 'SIMULATOR_BUNDLE', {value: Object.freeze({
                    buildId: ${JSON.stringify(buildId)},
                    url(file) {
                        if (!assets.has(file)) throw new Error('Asset is outside the selected bundle: ' + file);
                        return assets.get(file);
                    }
                })});
                importScripts(SIMULATOR_BUNDLE.url(${JSON.stringify(entry)}));
            })();`;
            workers.set(entry, retain(bootstrap, 'text/javascript'));
        }
        const workerUrl = file => {
            if (!workers.has(file)) throw new Error(`Unknown simulation worker: ${file}`);
            return workers.get(file);
        };
        Object.defineProperty(globalThis, 'SIMULATOR_BUNDLE', {value: Object.freeze({buildId, url: assetUrl, workerUrl})});
        for (const file of selected) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = assetUrl(file);
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Could not load bundle asset: ${file}`));
                document.head.appendChild(script);
            });
        }
        return globalThis.SIMULATOR_BUNDLE;
    })();
    globalThis.simulatorReady.catch(error => {
        for (const url of objectUrls) URL.revokeObjectURL(url);
        const show = () => {
            const alert = document.createElement('p');
            alert.setAttribute('role', 'alert');
            alert.textContent = 'The simulation bundle could not be loaded. Reload the page to try again.';
            document.body.prepend(alert);
        };
        if (document.body) show();
        else document.addEventListener('DOMContentLoaded', show, {once: true});
        console.error(error);
    });
})();
