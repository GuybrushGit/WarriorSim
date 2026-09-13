'use strict';
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/compute-protocol');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const common = ['libs/jquery-3.4.1', 'libs/jquery.tablesorter', 'libs/jquery.tablesorter.widgets', 'libs/Chart',
    'classes/player', 'classes/simulation', 'compute-protocol', 'shared-compute',
    'classes/spell', 'classes/weapon'];
// Preserve the page variants' catalog choices and established script order.
const entrypoints = {
    classic: [...common, 'data/gear', 'data/enchants', 'data/levelstats', 'data/buffs', 'data/spells',
        'data/talents', 'data/session', 'globals', 'settings', 'profiles', 'stats', 'ui'],
    sod: [...common, 'data/gear_sod', 'data/runes', 'data/levelstats', 'data/buffs', 'data/enchants',
        'data/spells', 'data/talents', 'data/session_sod', 'data/presets', 'globals', 'profiles',
        'settings', 'stats', 'ui'],
};
const scripts = mode => entrypoints[mode].map(name => `js/${name}.min.js`);

function buildBundle(root) {
    const dist = path.join(root, 'dist');
    const entries = new Map();
    function visit(directory, relative = '') {
        for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
            const name = relative + entry.name;
            if (entry.isDirectory()) visit(path.join(directory, entry.name), name + '/');
            else if (/\.(js|json)$/.test(name) && !['bundle-loader.min.js', 'compute-build.min.js'].includes(name)) {
                entries.set('js/' + name, fs.readFileSync(path.join(directory, entry.name)));
            }
        }
    }
    visit(path.join(dist, 'js'));
    for (const name of ['warriorsim.js', 'warriorsim.wasm']) {
        entries.set('wasm/' + name, fs.readFileSync(path.join(dist, 'wasm', name)));
    }
    // Format 2 requires the preloaded asset runtime in pages and workers.
    // Fixed field ordering and lexical path ordering are part of the format.
    const descriptor = {format: 2, protocol: P.version, specVersion: 1,
        entrypoints: {classic: scripts('classic'), sod: scripts('sod')},
        files: [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
            .map(([name, bytes]) => ({path: name, sha256: digest(bytes)}))};
    for (const list of Object.values(descriptor.entrypoints)) {
        for (const file of list) if (!entries.has(file)) throw new Error(`Missing bundle entrypoint: ${file}`);
    }
    const buildId = digest(JSON.stringify(descriptor));
    const manifest = {buildId, ...descriptor};
    const json = JSON.stringify(manifest) + '\n';
    // One directory, replaced whole: staging then swapping drops files this build no longer
    // produces and keeps a failed build from leaving a half-written bundle behind.
    const bundleRoot = path.join(dist, 'bundle');
    const staging = path.join(dist, 'bundle.tmp');
    fs.rmSync(staging, {recursive: true, force: true});
    for (const [name, bytes] of entries) {
        const destination = path.join(staging, name);
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.writeFileSync(destination, bytes);
    }
    fs.writeFileSync(path.join(staging, 'manifest.json'), json);
    fs.rmSync(bundleRoot, {recursive: true, force: true});
    fs.renameSync(staging, bundleRoot);
    // Publish the pointer only after the complete bundle exists.
    const pending = path.join(dist, 'compute-build.json.tmp');
    fs.writeFileSync(pending, json);
    fs.renameSync(pending, path.join(dist, 'compute-build.json'));
    return manifest;
}

if (require.main === module) buildBundle(path.resolve(__dirname, '..'));
module.exports = {buildBundle};
