/* Shared by the browser, coordinator, and protocol tests. No executable job payloads. */
(function(root) {
    'use strict';
    const protocol = {
        version: 3,
        maxChunks: 8192,
        maxChunkSize: 2000,
        leaseMs: 15000,
        // Outstanding leases one participant may hold: running plus waiting.
        maxQueue: 256,
        maxPayload: 1024 * 1024,
        buildId(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); },
        id(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value); },
        uint(value, min = 0, max = 0xffffffff) {
            return Number.isSafeInteger(value) && value >= min && value <= max;
        },
        queue(value, slots) {
            return protocol.uint(value, slots, Math.min(4 * slots, protocol.maxQueue));
        },
        safeTree(value, depth = 0, budget = {left: 30000}) {
            if (--budget.left < 0 || depth > 16) return false;
            if (value === null || typeof value === 'boolean') return true;
            if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e20;
            if (typeof value === 'string') return value.length <= 1024;
            if (typeof value !== 'object') return false;
            if (Array.isArray(value) && value.length > 8192) return false;
            return Object.keys(value).every(key => !['__proto__', 'constructor', 'prototype'].includes(key) &&
                key.length <= 100 && protocol.safeTree(value[key], depth + 1, budget));
        },
        spec(spec) {
            if (!spec || !protocol.safeTree(spec) || spec.version !== 1 || !spec.sim || !spec.player) return false;
            const sim = spec.sim, player = spec.player;
            if (!(sim.timesecsmin >= 1 && sim.timesecsmax >= sim.timesecsmin && sim.timesecsmax <= 600)) return false;
            if (!player.weapons || !player.weapons.mh || !Array.isArray(player.spells) ||
                !Array.isArray(player.auras) || player.spells.length > 128 || player.auras.length > 256) return false;
            return player.auras.every(aura => aura.props &&
                (aura.props.dataLength === undefined || protocol.uint(aura.props.dataLength, 0, 16)));
        },
        job(job) {
            return job && protocol.id(job.id) && protocol.uint(job.seed) &&
                protocol.uint(job.iterations, 1) && protocol.uint(job.offset) &&
                job.offset + job.iterations <= 0x100000000 &&
                protocol.uint(job.chunkSize, 1, protocol.maxChunkSize) &&
                Math.ceil(job.iterations / job.chunkSize) <= protocol.maxChunks &&
                typeof job.fullReport === 'boolean' && protocol.spec(job.spec);
        },
        range(job, index) {
            return {offset: job.offset + index * job.chunkSize,
                count: Math.min(job.chunkSize, job.iterations - index * job.chunkSize)};
        },
        report(report, job, index) {
            if (!report || !protocol.safeTree(report) || report.iterations !== protocol.range(job, index).count ||
                report.seed !== job.seed || !protocol.uint(report.engineVersion, 1)) return false;
            for (const key of ['totaldmg', 'totalduration', 'mindps', 'maxdps', 'sumdps', 'sumdps2', 'starttime', 'endtime']) {
                if (typeof report[key] !== 'number' || !Number.isFinite(report[key]) || report[key] < 0) return false;
            }
            if (report.totalduration <= 0 || report.mindps > report.maxdps) return false;
            if (!job.fullReport) return report.player === undefined && report.spread === undefined;
            if (!report.spread || !report.player || !report.player.mh) return false;
            if (!Object.entries(report.spread).every(([key, value]) => /^\d{1,7}$/.test(key) && protocol.uint(value))) return false;
            if (Object.values(report.spread).reduce((a, b) => a + b, 0) !== report.iterations) return false;
            const counter = (value, weapon) => value && typeof value.name === 'string' &&
                Array.isArray(value.data) && value.data.length <= 16 &&
                value.data.every(number => protocol.uint(number)) &&
                Number.isFinite(value.totaldmg) && value.totaldmg >= 0 &&
                (!weapon || (value.data.length === 5 && Number.isFinite(value.totalprocdmg) && value.totalprocdmg >= 0));
            if (!counter(report.player.mh, true) || (report.player.oh && !counter(report.player.oh, true))) return false;
            if (Boolean(report.player.oh) !== Boolean(job.spec.player.weapons.oh)) return false;
            if (!report.player.spells || !report.player.auras ||
                Object.keys(report.player.spells).length !== job.spec.player.spells.length ||
                Object.keys(report.player.auras).length !== job.spec.player.auras.length) return false;
            if (report.player.mh.name !== job.spec.player.weapons.mh.props.name ||
                (report.player.oh && report.player.oh.name !== job.spec.player.weapons.oh.props.name)) return false;
            for (const [key, value] of Object.entries(report.player.spells)) {
                const spell = job.spec.player.spells.find(spell => spell.key === key);
                if (!spell || !counter(value, false) || value.data.length !== 5 ||
                    value.name !== (spell.props.name || key) || !Number.isFinite(value.totalusedrage) ||
                    !Number.isFinite(value.cost)) return false;
            }
            for (const [key, value] of Object.entries(report.player.auras)) {
                const aura = job.spec.player.auras.find(aura => aura.key === key);
                if (!aura || value.name !== (aura.props.name || key) || !Number.isFinite(value.uptime) ||
                    !Number.isFinite(value.totaldmg) || value.totaldmg < 0 || value.uptime < 0 ||
                    !Array.isArray(value.data) || value.data.length !== (aura.props.dataLength || 0) ||
                    !value.data.every(number => protocol.uint(number))) return false;
            }
            return true;
        },
    };
    if (typeof module === 'object' && module.exports) module.exports = protocol;
    else root.ComputeProtocol = protocol;
})(globalThis);
