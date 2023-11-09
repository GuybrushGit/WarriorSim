var RESULT = {
    HIT: 0,
    MISS: 1,
    DODGE: 2,
    CRIT: 3,
    GLANCE: 4
}

var batching = 0;
var step = 0;
var log = false;
var version = 4;

const TYPE = {
    UPDATE: 0,
    FINISHED: 1,
    ERROR: 2,
}

class SimulationWorker {
    constructor(callback_finished, callback_update, callback_error) {
        this.worker = new Worker('/dist/js/sim-worker.min.js');
        this.worker.onerror = (...args) => {
            callback_error(...args);
            this.worker.terminate();
        };
        this.worker.onmessage = (event) => {
            const [type, ...args] = event.data;
            switch (type) {
                case TYPE.UPDATE:
                    callback_update(...args);
                    break;
                case TYPE.FINISHED:
                    callback_finished(...args);
                    this.worker.terminate();
                    break;
                case TYPE.ERROR:
                    callback_error(...args);
                    this.worker.terminate();
                    break;
                default:
                    callback_error(`Unexpected type: ${type}`);
                    this.worker.terminate();
            }
        };
    }

    start(params) {
        params.globals = getGlobalsDelta();
        this.worker.postMessage(params);
    }
}

class SimulationWorkerParallel {
    constructor(threads, callback_finished, callback_update, callback_error) {
        this.threads = threads;
        this.callback_finished = callback_finished;
        this.callback_update = callback_update;
        this.states = [...Array(this.threads)];
        this.workers = this.states.map((_, i) => new SimulationWorker(
            data => { this.states[i] = { status: 1, data }; this.update(); },
            (iteration, data) => { this.states[i] = { status: 0, iteration, data }; this.update(); },
            error => { if (!this.error) { this.error = error; callback_error(error); } },
        ));
    }

    update() {
        if (this.error) return;
        const completed = this.states.reduce((count, state) => count + (state && state.status || 0), 0);
        if (completed >= this.states.length) {
            const result = this.states[0].data;
            this.states.slice(1).forEach(({data}) => {
                result.iterations += data.iterations;
                result.totaldmg += data.totaldmg;
                result.totalduration += data.totalduration;
                result.mindps = Math.min(result.mindps, data.mindps);
                result.maxdps = Math.min(result.maxdps, data.maxdps);
                result.sumdps += data.sumdps;
                result.sumdps2 += data.sumdps2;
                result.starttime = Math.min(result.starttime, data.starttime);
                result.endtime = Math.min(result.endtime, data.endtime);
                if (result.spread && data.spread) {
                    for (let i in data.spread) {
                        result.spread[i] = (result.spread[i] || 0) + data.spread[i];
                    }
                }
                if (result.player && data.player) {
                    for (let id in data.player.auras) {
                        const src = data.player.auras[id], dst = result.player.auras[id];
                        if (!dst) {
                            result.player.auras[id] = src;
                        } else {
                            dst.uptime += src.uptime;
                            if (src.totaldmg) {
                                dst.totaldmg = (dst.totaldmg || 0) + src.totaldmg;
                            }
                        }
                    }
                    for (let id in data.player.spells) {
                        const src = data.player.spells[id], dst = result.player.spells[id];
                        if (!dst) {
                            result.player.spells[id] = src;
                        } else {
                            dst.totaldmg += src.totaldmg;
                            for (let i = 0; i < src.data.length; ++i) {
                                dst.data[i] += src.data[i];
                            }
                        }
                    }
                    function mergeWeapon(dst, src) {
                        if (dst) {
                            dst.totaldmg += src.totaldmg;
                            dst.totalprocdmg += src.totalprocdmg;
                            for (let i = 0; i < src.data.length; ++i) {
                                dst.data[i] += src.data[i];
                            }
                            return dst;
                        } else {
                            return src;
                        }
                    }
                    result.player.mh = mergeWeapon(result.player.mh, data.player.mh);
                    if (data.player.oh) result.player.oh = mergeWeapon(result.player.oh, data.player.oh);
                }
            });
            this.callback_finished(result);
        } else {
            let iteration = 0;
            const data = { iterations: this.iterations, totaldmg: 0, totalduration: 0 };
            this.states.forEach(state => {
                if (!state) return;
                iteration += (state.status ? state.data.iterations : state.iteration);
                data.totaldmg += state.data.totaldmg;
                data.totalduration += state.data.totalduration;
            });
            this.callback_update(iteration, data);
        }
    }

    start(params) {
        params.globals = getGlobalsDelta();
        this.iterations = params.sim.iterations;
        let remain = params.sim.iterations;
        this.workers.forEach((worker, i) => {
            const current = Math.round(remain / (this.workers.length - i));
            remain -= current;
            worker.start({...params, sim: {...params.sim, iterations: current}});
        });
    }
}

class Simulation {
    static getConfig() {
        return {
            timesecsmin: parseInt($('input[name="timesecsmin"]').val()),
            timesecsmax: parseInt($('input[name="timesecsmax"]').val()),
            executeperc: parseInt($('input[name="executeperc"]').val()),
            startrage: parseInt($('input[name="startrage"]').val()),
            iterations: parseInt($('input[name="simulations"]').val()),
            batching: parseInt($('select[name="batching"]').val()),
        };
    }
    constructor(player, callback_finished, callback_update, config) {
        if (!config) config = Simulation.getConfig();
        this.player = player;
        this.timesecsmin = config.timesecsmin;
        this.timesecsmax = config.timesecsmax;
        this.executeperc = config.executeperc;
        this.startrage = config.startrage;
        this.iterations = config.iterations;
        batching = config.batching;
        this.idmg = 0;
        this.totaldmg = 0;
        this.totalduration = 0;
        this.mindps = 99999;
        this.maxdps = 0;
        this.sumdps = 0;
        this.sumdps2 = 0;
        this.maxcallstack = Math.min(Math.floor(this.iterations / 10), 1000);
        this.starttime = 0;
        this.endtime = 0;
        this.cb_update = callback_update;
        this.cb_finished = callback_finished;
        this.spread = [];

        if (this.iterations == 1) log = true;
        else log = false;
    }
    startSync() {
        this.starttime = new Date().getTime();
        let iteration;
        for (iteration = 1; iteration <= this.iterations; ++iteration) {
            this.run();
            if (iteration % this.maxcallstack == 0) {
                this.update(iteration);
            }
        }
        this.endtime = new Date().getTime();
        this.finished();
    }
    startAsync() {
        this.starttime = new Date().getTime();
        this.runAsync(1);
    }
    runAsync(iteration) {
        this.run();
        if (iteration == this.iterations) {
            this.endtime = new Date().getTime();
            this.finished();
        } else if (iteration % this.maxcallstack == 0) {
            this.update(iteration);
            setTimeout(() => this.runAsync(iteration + 1), 0);
        } else {
            this.runAsync(iteration + 1);
        }
    }
    run() {
        step = 0;
        this.idmg = 0;
        let player = this.player;
        player.reset(this.startrage);
        this.maxsteps = rng(this.timesecsmin * 1000, this.timesecsmax * 1000);
        this.duration = this.maxsteps / 1000;
        this.executestep = this.maxsteps - parseInt(this.maxsteps * (this.executeperc / 100));
        let delayedspell, delayedheroic;
        let spellcheck = false;
        let next = 0;

        // determine when to use item auras
        let itemdelay = 0;
        if (player.auras.flask) { this.flaskstep = Math.max(this.maxsteps - 60000, 0); itemdelay += 60000; }
        if (player.auras.cloudkeeper) { this.cloudstep = Math.max(this.maxsteps - itemdelay - 30000, 0); itemdelay += 30000; }
        if (player.auras.slayer) { this.slayerstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.spider) { this.spiderstep = Math.max(this.maxsteps - itemdelay - 15000, 0); itemdelay += 15000; }
        if (player.auras.gabbar) { this.gabbarstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.earthstrike) { this.earthstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.pummeler) { this.pummelstep = Math.max(this.maxsteps - itemdelay - 30000, 0); itemdelay += 30000; }
        if (player.auras.zandalarian) { this.zandalarstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }

        // determine when to use player auras
        if (player.auras.deathwish) { player.auras.deathwish.usestep = Math.max(this.maxsteps - player.auras.deathwish.timetoend, 0); }
        if (player.auras.recklessness) { player.auras.recklessness.usestep = Math.max(this.maxsteps - player.auras.recklessness.timetoend, 0); }
        if (player.auras.mightyragepotion) { player.auras.mightyragepotion.usestep = Math.max(this.maxsteps - player.auras.mightyragepotion.timetoend, 0); }
        if (player.auras.berserking) { player.auras.berserking.usestep = Math.max(this.maxsteps - player.auras.berserking.timetoend, 0); }
        if (player.auras.bloodfury) { player.auras.bloodfury.usestep = Math.max(this.maxsteps - player.auras.bloodfury.timetoend, 0); }
        if (player.auras.swarmguard) { player.auras.swarmguard.usestep = Math.max(this.maxsteps - player.auras.swarmguard.timetoend, 0); }

        while (step < this.maxsteps) {

            // Passive ticks
            if (next != 0 && step % 3000 == 0 && player.talents.angermanagement) {
                player.rage = player.rage >= 99 ? 100 : player.rage + 1;
                spellcheck = true;
                if (player.auras.consumedrage && player.rage > 80 && player.rage <= 81)
                    player.auras.consumedrage.use();
            }
            if (player.vaelbuff && next != 0 && step % 1000 == 0) {
                player.rage = player.rage >= 80 ? 100 : player.rage + 20;
                spellcheck = true;
                if (player.auras.consumedrage && player.rage > 80)
                    player.auras.consumedrage.use();
            }

            // Attacks
            if (player.mh.timer <= 0) {
                this.idmg += player.attackmh(player.mh);
                spellcheck = true;
            }
            if (player.oh && player.oh.timer <= 0) {
                this.idmg += player.attackoh(player.oh);
                spellcheck = true;
            }

            // Spells
            if (spellcheck && !player.spelldelay) {

                // opener
                if (player.spells.victoryrush && player.spells.victoryrush.canUse()) { player.spelldelay = 1; delayedspell = player.spells.victoryrush; }

                // Use no GCD spells
                else if (player.auras.swarmguard && player.auras.swarmguard.canUse()) { player.spelldelay = 1; delayedspell = player.auras.swarmguard; }
                else if (player.auras.mightyragepotion && player.auras.mightyragepotion.canUse()) { player.spelldelay = 1; delayedspell = player.auras.mightyragepotion; }
                else if (player.spells.bloodrage && player.spells.bloodrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodrage; }
                else if (player.spells.ragepotion && player.spells.ragepotion.canUse()) { player.spelldelay = 1; delayedspell = player.spells.ragepotion; }
                
                // Use GCD spells
                else if (player.timer) { }
                else if (player.auras.flask && player.auras.flask.canUse() && step > this.flaskstep) { player.spelldelay = 1; delayedspell = player.auras.flask; }
                else if (player.auras.cloudkeeper && player.auras.cloudkeeper.canUse() && step > this.cloudstep) { player.spelldelay = 1; delayedspell = player.auras.cloudkeeper; }
                else if (player.auras.recklessness && player.auras.recklessness.canUse()) { player.spelldelay = 1; delayedspell = player.auras.recklessness; }
                else if (player.auras.deathwish && player.auras.deathwish.canUse()) { player.spelldelay = 1; delayedspell = player.auras.deathwish; }
                else if (player.auras.bloodfury && player.auras.bloodfury.canUse()) { player.spelldelay = 1; delayedspell = player.auras.bloodfury; }
                else if (player.auras.berserking && player.auras.berserking.canUse()) { player.spelldelay = 1; delayedspell = player.auras.berserking; }

                else if (player.auras.slayer && player.auras.slayer.canUse() && step > this.slayerstep) { player.spelldelay = 1; delayedspell = player.auras.slayer; }
                else if (player.auras.spider && player.auras.spider.canUse() && step > this.spiderstep) { player.spelldelay = 1; delayedspell = player.auras.spider; }
                else if (player.auras.gabbar && player.auras.gabbar.canUse() && step > this.gabbarstep) { player.spelldelay = 1; delayedspell = player.auras.gabbar; }
                else if (player.auras.earthstrike && player.auras.earthstrike.canUse() && step > this.earthstep) { player.spelldelay = 1; delayedspell = player.auras.earthstrike; }
                else if (player.auras.pummeler && player.auras.pummeler.canUse() && step > this.pummelstep) { player.spelldelay = 1; delayedspell = player.auras.pummeler; }
                else if (player.auras.zandalarian && player.auras.zandalarian.canUse() && step > this.zandalarstep) { player.spelldelay = 1; delayedspell = player.auras.zandalarian; }
                
                // Execute phase
                else if (player.spells.execute && step >= this.executestep) {

                    if (player.spells.ragingblow && player.spells.ragingblow.canUse(true)) { 
                        player.spelldelay = 1; delayedspell = player.spells.ragingblow; 
                    }
                    else if (player.stats.ap >= player.spells.execute.priorityap) {
                        if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) {
                            player.spelldelay = 1; delayedspell = player.spells.bloodthirst;
                        }
                        else if (player.spells.mortalstrike && player.spells.mortalstrike.canUse()) {
                            player.spelldelay = 1; delayedspell = player.spells.mortalstrike;
                        }
                    }
                    else if (player.spells.execute.canUse()) {
                        player.spelldelay = 1; delayedspell = player.spells.execute;
                    }
                }

                // Normal phase - no cost
                else if (player.spells.ragingblow && player.spells.ragingblow.canUse(false)) { player.spelldelay = 1; delayedspell = player.spells.ragingblow; }
                else if (player.spells.berserkerrage && player.spells.berserkerrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.berserkerrage; }
                
                // prevent using spells while waiting for consumed by rage proc
                else if (player.auras.consumedrage && player.auras.consumedrage.procblock && !player.auras.consumedrage.timer) { } 
                else if (player.auras.consumedrage && player.auras.consumedrage.rageblockactive && player.rage < player.auras.consumedrage.rageblock) { } 

                // Normal phase - rage cost
                else if (player.spells.sunderarmor && player.spells.sunderarmor.canUse()) { player.spelldelay = 1; delayedspell = player.spells.sunderarmor; }
                else if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodthirst; }
                else if (player.spells.mortalstrike && player.spells.mortalstrike.canUse()) { player.spelldelay = 1; delayedspell = player.spells.mortalstrike; }
                else if (player.spells.quickstrike && player.spells.quickstrike.canUse()) { player.spelldelay = 1; delayedspell = player.spells.quickstrike; }
                else if (player.spells.whirlwind && player.spells.whirlwind.canUse()) { player.spelldelay = 1; delayedspell = player.spells.whirlwind; }
                else if (player.spells.overpower && player.spells.overpower.canUse()) { player.spelldelay = 1; delayedspell = player.spells.overpower; }
                else if (player.spells.hamstring && player.spells.hamstring.canUse()) { player.spelldelay = 1; delayedspell = player.spells.hamstring; }
                else if (player.auras.rend && player.auras.rend.canUse()) { player.spelldelay = 1; delayedspell = player.auras.rend; }

                if (player.heroicdelay) spellcheck = false;
            }

            // Heroic Strike
            if (spellcheck && !player.heroicdelay) {
                if (!player.spells.execute || step < this.executestep) {
                    // prevent using spells while waiting for consumed by rage proc
                    if (player.auras.consumedrage && player.auras.consumedrage.procblock && !player.auras.consumedrage.timer) { } 
                    else if (player.auras.consumedrage && player.auras.consumedrage.rageblockactive && player.rage < player.auras.consumedrage.rageblock) { } 
                    else if (player.spells.heroicstrike && player.spells.heroicstrike.canUse()) { 
                        player.heroicdelay = 1; delayedheroic = player.spells.heroicstrike; 
                    
                    }
                }

                spellcheck = false;
            }

            // Cast spells
            if (player.spelldelay && delayedspell && player.spelldelay > delayedspell.maxdelay) {

                // Prevent casting HS and other spells at the exact same time
                if (player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic.maxdelay)
                    player.heroicdelay = delayedheroic.maxdelay - 49;

                if (delayedspell.canUse()) {
                    this.idmg += player.cast(delayedspell, delayedheroic);
                    player.spelldelay = 0;
                    spellcheck = true;
                }
                else {
                    player.spelldelay = 0;
                }
            }

            // Cast HS
            if (player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic.maxdelay) {
                if (delayedheroic.canUse()) {
                    player.cast(delayedheroic);
                    player.heroicdelay = 0;
                    spellcheck = true;
                }
                else {
                    player.heroicdelay = 0;
                }
            }

            // Unqueue HS
            if (!player.spells.execute || step < this.executestep) {
                if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue && player.nextswinghs &&
                    player.rage < player.spells.heroicstrike.unqueue && player.mh.timer <= player.spells.heroicstrike.unqueuetimer) {
                    this.player.nextswinghs = false;
                    if (log) this.player.log(`Heroic Strike unqueued`);
                }
            }

            // Extra attacks
            if (player.extraattacks > 0) {
                player.mh.timer = 0;
                player.extraattacks--;
            }
            if (player.batchedextras > 0) {
                player.mh.timer = batching - (step % batching);
                player.batchedextras--;
            }
            
            // Determine when next step should happen
            if (!player.mh.timer || (!player.spelldelay && spellcheck) || (!player.heroicdelay && spellcheck)) { next = 0; continue; }
            next = Math.min(player.mh.timer, player.oh ? player.oh.timer : 9999);
            if (player.spelldelay && (delayedspell.maxdelay - player.spelldelay) < next) next = delayedspell.maxdelay - player.spelldelay + 1;
            if (player.heroicdelay && (delayedheroic.maxdelay - player.heroicdelay) < next) next = delayedheroic.maxdelay - player.heroicdelay + 1;
            if (player.timer && player.timer < next) next = player.timer;
            if (player.itemtimer && player.itemtimer < next) next = player.itemtimer;

            // Auras with periodic ticks
            if (player.talents.angermanagement && (3000 - (step % 3000)) < next) next = 3000 - (step % 3000);
            if (player.vaelbuff && (1000 - (step % 1000)) < next) next = 1000 - (step % 1000);
            if (player.auras.bloodrage && player.auras.bloodrage.timer && (1000 - ((step - player.auras.bloodrage.starttimer) % 1000)) < next)
                next = 1000 - ((step - player.auras.bloodrage.starttimer) % 1000);
            if (player.auras.gabbar && player.auras.gabbar.timer && (2000 - ((step - player.auras.gabbar.starttimer) % 2000)) < next)
                next = 2000 - ((step - player.auras.gabbar.starttimer) % 2000);

            // Spells used by player
            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && player.spells.bloodthirst.timer < next) next = player.spells.bloodthirst.timer;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && player.spells.mortalstrike.timer < next) next = player.spells.mortalstrike.timer;
            if (player.spells.quickstrike && player.spells.quickstrike.timer && player.spells.quickstrike.timer < next) next = player.spells.quickstrike.timer;
            if (player.spells.ragingblow && player.spells.ragingblow.timer && player.spells.ragingblow.timer < next) next = player.spells.ragingblow.timer;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && player.spells.whirlwind.timer < next) next = player.spells.whirlwind.timer;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && player.spells.bloodrage.timer < next) next = player.spells.bloodrage.timer;
            if (player.spells.ragepotion && player.spells.ragepotion.timer && player.spells.ragepotion.timer < next) next = player.spells.ragepotion.timer;
            if (player.spells.overpower && player.spells.overpower.timer && player.spells.overpower.timer < next) next = player.spells.overpower.timer;
            if (player.spells.execute && player.spells.execute.timer && player.spells.execute.timer < next) next = player.spells.execute.timer;

            if (!player.spells.execute || step < this.executestep) {
                if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue) {
                    let timeleft = Math.max(player.mh.timer - player.spells.heroicstrike.unqueuetimer);
                    if (timeleft > 0 && timeleft < next) next = timeleft;
                }
            }

            step += next;
            player.mh.step(next);
            if (player.oh) player.oh.step(next);

            // Determine if a spell check should happen next step
            if (player.timer && player.steptimer(next) && !player.spelldelay) spellcheck = true;
            if (player.itemtimer && player.stepitemtimer(next) && !player.spelldelay) spellcheck = true;
            if (player.dodgetimer) player.stepdodgetimer(next);
            if (player.spelldelay) player.spelldelay += next;
            if (player.heroicdelay) player.heroicdelay += next;

            // Spells used by player
            if (player.spells.ragingblow && player.spells.ragingblow.timer && !player.spells.ragingblow.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.berserkerrage && player.spells.berserkerrage.timer && !player.spells.berserkerrage.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && !player.spells.bloodthirst.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && !player.spells.mortalstrike.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.quickstrike && player.spells.quickstrike.timer && !player.spells.quickstrike.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && !player.spells.whirlwind.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && !player.spells.bloodrage.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.ragepotion && player.spells.ragepotion.timer && !player.spells.ragepotion.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.overpower && player.spells.overpower.timer && !player.spells.overpower.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.execute && player.spells.execute.timer && !player.spells.execute.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.hamstring && player.spells.hamstring.timer && !player.spells.hamstring.step(next) && !player.spelldelay) spellcheck = true;

            // Auras with periodic ticks
            if (player.auras.bloodrage && player.auras.bloodrage.timer && !player.auras.bloodrage.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.gabbar && player.auras.gabbar.timer) player.auras.gabbar.step();
        }

        // Fight done
        player.endauras();

        if (player.auras.deepwounds) {
            this.idmg += player.auras.deepwounds.idmg;
        }
        if (player.auras.rend) {
            this.idmg += player.auras.rend.idmg;
        }
        this.totaldmg += this.idmg;
        this.totalduration += this.duration;
        let dps = this.idmg / this.duration;
        if (dps < this.mindps) this.mindps = dps;
        if (dps > this.maxdps) this.maxdps = dps;
        this.sumdps += dps;
        this.sumdps2 += dps * dps;
        dps = Math.round(dps);
        if (!this.spread[dps]) this.spread[dps] = 1;
        else this.spread[dps]++;
    }
    update(iteration) {
        if (this.cb_update) {
            this.cb_update(iteration, {
                iterations: this.iterations,
                totaldmg: this.totaldmg,
                totalduration: this.totalduration,
            });
        }
    }
    finished() {
        if (this.cb_finished) {
            this.cb_finished({
                iterations: this.iterations,
                totaldmg: this.totaldmg,
                totalduration: this.totalduration,
                mindps: this.mindps,
                maxdps: this.maxdps,
                sumdps: this.sumdps,
                sumdps2: this.sumdps2,
                starttime: this.starttime,
                endtime: this.endtime,
            });
        }
    }
}

function rng(min, max) {
    return ~~(Math.random() * (max - min + 1) + min);
}

function rng10k() {
    return ~~(Math.random() * 10000);
}

function avg(min, max) {
    return (min + max) / 2;
}
