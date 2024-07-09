var RESULT = {
    HIT: 0,
    MISS: 1,
    DODGE: 2,
    CRIT: 3,
    GLANCE: 4
}

var DEFENSETYPE = {
    NONE: 0,
    MAGIC: 1,
    MELEE: 2,
    RANGED: 3,
}

var SCHOOL = {
    NONE: 0,
    PHYSICAL: 1,
    HOLY: 2,
    FIRE: 4,
    NATURE: 8,
    FROST: 16,
    SHADOW: 32,
    ARCANE: 64,
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
        this.worker = new Worker('./dist/js/sim-worker.min.js');
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
                            if (src.data) {
                                for (let i = 0; i < src.data.length; ++i) {
                                    dst.data[i] += src.data[i];
                                }
                            }
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
        let canSpellQueue = false;
        let next = 0;
        let slamstep = 0;
        let stopstep = 0;

        // determine when to use on use items
        let itemdelay = 0;
        for(let spell of player.preporder) {
            if (spell.aura) 
                itemdelay += player.auras[spell.classname.toLowerCase()].prep(this.maxsteps, itemdelay);
            else if (player.spells[spell.classname.toLowerCase()].prep)
                player.spells[spell.classname.toLowerCase()].prep(this.maxsteps);
        }

        while (step < this.maxsteps) {

            // Passive ticks
            if (next != 0 && step % 3000 == 0 && player.talents.angermanagement) {
                player.rage = player.rage >= 99 ? 100 : player.rage + 1;
                spellcheck = true;
                if (player.auras.consumedrage && player.rage >= 60 && player.rage < 81)
                    player.auras.consumedrage.use();
            }
            if (player.vaelbuff && next != 0 && step % 1000 == 0) {
                player.rage = player.rage >= 60 ? 100 : player.rage + 20;
                spellcheck = true;
                if (player.auras.consumedrage && player.rage >= 60)
                    player.auras.consumedrage.use();
            }
            if (player.spells.themoltencore && next != 0 && step % 2000 == 0) {
                player.spells.themoltencore.use();
            }

            if (player.target.speed && step % player.target.speed == 0) {
                let oldRage = player.rage;
                let dmg = rng(player.target.mindmg, player.target.maxdmg);
                let gained = dmg / player.rageconversion * 2.5;
                player.rage = Math.min(player.rage + gained, 100);
                spellcheck = true;
                if (player.auras.consumedrage && player.rage >= 60 && oldRage < 60)
                    player.auras.consumedrage.use();
                /* start-log */ if (log) this.player.log(`Target attack for ${dmg} gained ${gained.toFixed(2)} rage `); /* end-log */
            }

            // Stop everything
            if (stopstep && step > stopstep) {
                player.timer = 20000;
                player.mh.timer = 20000;
                player.oh.timer = 20000;
            }

             // Don't do anything while casting slam
            if (!slamstep) {

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

                    // Use no GCD spells
                    if (player.auras.swarmguard && player.auras.swarmguard.canUse()) { player.spelldelay = 1; delayedspell = player.auras.swarmguard; }
                    else if (player.auras.mightyragepotion && player.auras.mightyragepotion.canUse()) { player.spelldelay = 1; delayedspell = player.auras.mightyragepotion; }
                    else if (player.spells.ragepotion && player.spells.ragepotion.canUse()) { player.spelldelay = 1; delayedspell = player.spells.ragepotion; }
                    else if (player.spells.fireball && player.spells.fireball.canUse()) { player.spelldelay = 1; delayedspell = player.spells.fireball; }
                    else if (player.spells.gunaxe && player.spells.gunaxe.canUse()) { player.spelldelay = 1; delayedspell = player.spells.gunaxe; }
                    else if (player.auras.mildlyirradiated && player.auras.mildlyirradiated.canUse()) { player.spelldelay = 1; delayedspell = player.auras.mildlyirradiated; }
                    else if (player.auras.jujuflurry && player.auras.jujuflurry.canUse()) { player.spelldelay = 1; delayedspell = player.auras.jujuflurry; }

                    else if (!player.timer && player.spells.berserkerrage && player.spells.berserkerrage.zerkerpriority && player.spells.berserkerrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.berserkerrage; }
                    else if (player.spells.bloodrage && player.spells.bloodrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodrage; }

                    else if (player.auras.cloudkeeper && player.auras.cloudkeeper.canUse()) { player.spelldelay = 1; delayedspell = player.auras.cloudkeeper; }
                    else if (player.auras.voidmadness && player.auras.voidmadness.canUse()) { player.spelldelay = 1; delayedspell = player.auras.voidmadness; }
                    else if (player.auras.gyromaticacceleration && player.auras.gyromaticacceleration.canUse()) { player.spelldelay = 1; delayedspell = player.auras.gyromaticacceleration; }
                    else if (player.auras.gneurological && player.auras.gneurological.canUse()) { player.spelldelay = 1; delayedspell = player.auras.gneurological; }
                    else if (player.auras.coinflip && player.auras.coinflip.canUse()) { player.spelldelay = 1; delayedspell = player.auras.coinflip; }
                    else if (player.auras.pummeler && player.auras.pummeler.canUse()) { player.spelldelay = 1; delayedspell = player.auras.pummeler; }
                    else if (player.auras.slayer && player.auras.slayer.canUse()) { player.spelldelay = 1; delayedspell = player.auras.slayer; }
                    else if (player.auras.spider && player.auras.spider.canUse()) { player.spelldelay = 1; delayedspell = player.auras.spider; }
                    else if (player.auras.gabbar && player.auras.gabbar.canUse()) { player.spelldelay = 1; delayedspell = player.auras.gabbar; }
                    else if (player.auras.earthstrike && player.auras.earthstrike.canUse()) { player.spelldelay = 1; delayedspell = player.auras.earthstrike; }
                    else if (player.auras.roarguardian && player.auras.roarguardian.canUse()) { player.spelldelay = 1; delayedspell = player.auras.roarguardian; }
                    else if (player.auras.zandalarian && player.auras.zandalarian.canUse()) { player.spelldelay = 1; delayedspell = player.auras.zandalarian; }
                    else if (player.auras.relentlessstrength && player.auras.relentlessstrength.canUse()) { player.spelldelay = 1; delayedspell = player.auras.relentlessstrength; }
                    else if (player.auras.demontaintedblood && player.auras.demontaintedblood.canUse()) { player.spelldelay = 1; delayedspell = player.auras.demontaintedblood; }
                    else if (player.auras.moonstalkerfury && player.auras.moonstalkerfury.canUse()) { player.spelldelay = 1; delayedspell = player.auras.moonstalkerfury; }

                    // Use GCD spells
                    else if (player.timer) { }
                    else if (player.spells.stanceswitch.canUse()) { player.spelldelay = 1; delayedspell = player.spells.stanceswitch; }
                    else if (player.spells.unstoppablemight && player.spells.unstoppablemight.canUse()) { player.spelldelay = 1; delayedspell = player.spells.unstoppablemight; }
                    else if (player.spells.victoryrush && player.spells.victoryrush.canUse()) { player.spelldelay = 1; delayedspell = player.spells.victoryrush; }
                    else if (player.auras.flask && player.auras.flask.canUse()) { player.spelldelay = 1; delayedspell = player.auras.flask; }
                    else if (player.auras.recklessness && player.auras.recklessness.canUse()) { player.spelldelay = 1; delayedspell = player.auras.recklessness; }
                    else if (player.auras.deathwish && player.auras.deathwish.canUse()) { player.spelldelay = 1; delayedspell = player.auras.deathwish; }
                    else if (player.auras.bloodfury && player.auras.bloodfury.canUse()) { player.spelldelay = 1; delayedspell = player.auras.bloodfury; }
                    else if (player.auras.berserking && player.auras.berserking.canUse()) { player.spelldelay = 1; delayedspell = player.auras.berserking; }
                    else if (player.spells.berserkerrage && player.spells.berserkerrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.berserkerrage; }
                    else if (player.auras.battleshout && player.auras.battleshout.canUse()) { player.spelldelay = 1; delayedspell = player.auras.battleshout; }

                    // Execute phase
                    else if (player.spells.execute && (step >= this.executestep || (player.auras.suddendeath && player.auras.suddendeath.timer))) {

                        if (player.spells.ragingblow && player.spells.ragingblow.canUse(true)) { 
                            player.spelldelay = 1; delayedspell = player.spells.ragingblow; 
                        }
                        else if (player.spells.berserkerrage && player.spells.berserkerrage.canUse()) { 
                            player.spelldelay = 1; delayedspell = player.spells.berserkerrage; 
                        }
                        else if (player.spells.slam && player.freeslam && player.spells.slam.canUse()) { 
                            player.spelldelay = 1; delayedspell = player.spells.slam; 
                        }
                        else if (player.spells.shieldslam && player.freeshieldslam && player.spells.shieldslam.canUse()) { 
                            player.spelldelay = 1; delayedspell = player.spells.shieldslam; 
                        }
                        else if (player.auras.consumedrage && player.auras.consumedrage.erageblock && player.rage < player.auras.consumedrage.erageblock) { } 
                        else if (player.auras.consumedrage && player.auras.consumedrage.echargeblock && player.auras.consumedrage.stacks < player.auras.consumedrage.echargeblock && player.rage < 60) { } 
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
                    else if (player.auras.rampage && player.auras.rampage.canUse()) { player.spelldelay = 1; delayedspell = player.auras.rampage; }
                    else if (player.spells.slam && player.freeslam && player.spells.slam.canUse()) { player.spelldelay = 1; delayedspell = player.spells.slam; }
                    else if (player.spells.shieldslam && player.freeshieldslam && player.spells.shieldslam.canUse()) { player.spelldelay = 1; delayedspell = player.spells.shieldslam; }
                    else if (player.spells.blademasterfury && player.spells.blademasterfury.canUse()) { player.spelldelay = 1; delayedspell = player.spells.blademasterfury; }
                    
                    // prevent using spells while waiting for consumed by rage proc
                    else if (player.auras.consumedrage && player.auras.consumedrage.procblock && !player.auras.consumedrage.timer && player.rage < 60) { } 
                    else if (player.auras.consumedrage && player.auras.consumedrage.rageblock && player.rage < player.auras.consumedrage.rageblock) { } 
                    else if (player.auras.consumedrage && player.auras.consumedrage.chargeblock && player.auras.consumedrage.stacks < player.auras.consumedrage.chargeblock && player.rage < 60) { } 
                    
                    // Normal phase - rage cost
                    else if (player.spells.overpower && player.spells.overpower.canUse()) { player.spelldelay = 1; delayedspell = player.spells.overpower; }
                    else if (player.auras.rend && player.auras.rend.canUse()) { player.spelldelay = 1; delayedspell = player.auras.rend; }
                    else if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodthirst; }
                    else if (player.spells.mortalstrike && player.spells.mortalstrike.canUse()) { player.spelldelay = 1; delayedspell = player.spells.mortalstrike; }
                    else if (player.spells.shieldslam && player.spells.shieldslam.canUse()) { player.spelldelay = 1; delayedspell = player.spells.shieldslam; }
                    else if (player.precisetiming && player.spells.slam && player.spells.slam.canUse()) { player.spelldelay = 1; delayedspell = player.spells.slam; }
                    else if (player.spells.whirlwind && player.spells.whirlwind.canUse()) { player.spelldelay = 1; delayedspell = player.spells.whirlwind; }
                    else if (player.spells.shockwave && player.spells.shockwave.canUse()) { player.spelldelay = 1; delayedspell = player.spells.shockwave; }
                    else if (!player.precisetiming && player.spells.slam && player.spells.slam.canUse()) { player.spelldelay = 1; delayedspell = player.spells.slam; }
                    else if (player.spells.thunderclap && player.spells.thunderclap.canUse()) { player.spelldelay = 1; delayedspell = player.spells.thunderclap; }
                    else if (player.spells.ragingblow && player.spells.ragingblow.canUse(false)) { player.spelldelay = 1; delayedspell = player.spells.ragingblow; }
                    else if (player.spells.quickstrike && player.spells.quickstrike.canUse()) { player.spelldelay = 1; delayedspell = player.spells.quickstrike; }
                    else if (player.spells.sunderarmor && player.spells.sunderarmor.canUse()) { player.spelldelay = 1; delayedspell = player.spells.sunderarmor; }
                    else if (player.spells.hamstring && player.spells.hamstring.canUse()) { player.spelldelay = 1; delayedspell = player.spells.hamstring; }

                    if (player.heroicdelay) spellcheck = false;
                }

                // Heroic Strike
                if (spellcheck && !player.heroicdelay) {
                    if (!player.spells.execute || (step < this.executestep && (!player.auras.suddendeath || !player.auras.suddendeath.timer))) {
                        // prevent using spells while waiting for consumed by rage proc
                        if (player.auras.consumedrage && player.auras.consumedrage.procblock && !player.auras.consumedrage.timer && player.rage < 60) { } 
                        else if (player.auras.consumedrage && player.auras.consumedrage.rageblock && player.rage < player.auras.consumedrage.rageblock) { } 
                        else if (player.auras.consumedrage && player.auras.consumedrage.chargeblock && player.auras.consumedrage.stacks < player.auras.consumedrage.chargeblock && player.rage < 60) { } 

                        else if (player.spells.heroicstrike && player.spells.heroicstrike.canUse()) { 
                            player.heroicdelay = 1; delayedheroic = player.spells.heroicstrike;
                        }
                        else if (player.spells.cleave && player.spells.cleave.canUse()) { 
                            player.heroicdelay = 1; delayedheroic = player.spells.cleave;
                        }
                    }

                    spellcheck = false;
                }

                // Cast spells
                if (player.spelldelay && delayedspell && (canSpellQueue || player.spelldelay > delayedspell.maxdelay)) {

                    // Prevent casting HS and other spells at the exact same time
                    if (player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic.maxdelay)
                        player.heroicdelay = delayedheroic.maxdelay - 99;

                    if (delayedspell.canUse()) {
                        // Start casting slam
                        if (delayedspell instanceof Slam) {
                            slamstep = step + delayedspell.casttime;
                            if (player.freeslam) slamstep = step;
                            player.timer = 1500;
                            player.heroicdelay = 0;
                            player.nextswinghs = false;
                            next = 0;
                            /* start-log */ if (log) this.player.log(`Casting Slam`); /* end-log */
                            continue;
                        }

                        let done = player.cast(delayedspell, delayedheroic)
                        this.idmg += done;
                        player.spelldelay = 0;
                        spellcheck = true;

                        if (delayedspell.offhandhit && player.oh) {
                            done = player.castoh(delayedspell);
                            this.idmg += done;
                        }

                        if (delayedspell instanceof Whirlwind || delayedspell instanceof BlademasterFury || delayedspell instanceof ThunderClap || delayedspell instanceof Shockwave) {
                            for (let i = 0; i < player.adjacent; i++) {
                                done = player.cast(delayedspell, delayedheroic, player.adjacent, done);
                                this.idmg += done;
                                if (delayedspell.offhandhit && player.oh) {
                                    done = player.castoh(delayedspell, player.adjacent, done);
                                    this.idmg += done;
                                }
                            }
                        }
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
                if (!player.spells.execute || (step < this.executestep && (!player.auras.suddendeath || !player.auras.suddendeath.timer))) {
                    if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue && player.nextswinghs &&
                        player.rage < player.spells.heroicstrike.unqueue && player.mh.timer <= player.spells.heroicstrike.unqueuetimer) {
                        this.player.nextswinghs = false;
                        /* start-log */ if (log) this.player.log(`Heroic Strike unqueued`); /* end-log */
                    }
                    else if (player.spells.cleave && player.spells.cleave.unqueue && player.nextswinghs &&
                        player.rage < player.spells.cleave.unqueue && player.mh.timer <= player.spells.cleave.unqueuetimer) {
                        this.player.nextswinghs = false;
                        /* start-log */ if (log) this.player.log(`Cleave unqueued`); /* end-log */
                    }
                }

                
            }

            // Slam casting done
            if (slamstep && step == slamstep) {
                let done = player.cast(delayedspell, delayedheroic)
                this.idmg += done;
                if (delayedspell.offhandhit && player.oh) {
                    done = player.castoh(delayedspell);
                    this.idmg += done;
                }
                spellcheck = true;
                slamstep = 0;
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
            if (!slamstep) {
                if (!player.mh.timer || (!player.spelldelay && spellcheck) || (!player.heroicdelay && spellcheck)) { next = 0; continue; }
                next = Math.min(player.mh.timer, player.oh ? player.oh.timer : 9999);
                if (player.spelldelay && (delayedspell.maxdelay - player.spelldelay) < next) next = delayedspell.maxdelay - player.spelldelay + 1;
                if (player.heroicdelay && (delayedheroic.maxdelay - player.heroicdelay) < next) next = delayedheroic.maxdelay - player.heroicdelay + 1;
            }
            else {
                next = slamstep - step;
            }

            if (player.timer && player.timer < next) next = player.timer;
            if (player.itemtimer && player.itemtimer < next) next = player.itemtimer;
            if (player.stancetimer && player.stancetimer < next) next = player.stancetimer;
            if (player.ragetimer && player.ragetimer < next) next = player.ragetimer;

            // Auras with periodic ticks
            if (player.target.speed && (player.target.speed - (step % player.target.speed)) < next) next = player.target.speed - (step % player.target.speed);
            if (player.talents.angermanagement && (3000 - (step % 3000)) < next) next = 3000 - (step % 3000);
            if (player.vaelbuff && (1000 - (step % 1000)) < next) next = 1000 - (step % 1000);
            if (player.spells.themoltencore && (2000 - (step % 2000)) < next) next = 2000 - (step % 2000);
            if (player.auras.bloodrage && player.auras.bloodrage.timer && (1000 - ((step - player.auras.bloodrage.starttimer) % 1000)) < next)
                next = 1000 - ((step - player.auras.bloodrage.starttimer) % 1000);
            if (player.auras.gabbar && player.auras.gabbar.timer && (2000 - ((step - player.auras.gabbar.starttimer) % 2000)) < next)
                next = 2000 - ((step - player.auras.gabbar.starttimer) % 2000);
            if (player.auras.rend && player.auras.rend.timer && (3000 - ((step - player.auras.rend.starttimer) % 3000)) < next)
                next = 3000 - ((step - player.auras.rend.starttimer) % 3000);

            if (player.auras.deepwounds && player.auras.deepwounds.timer && (player.auras.deepwounds.nexttick - step) < next)
                next = player.auras.deepwounds.nexttick - step;
            if (player.adjacent) {
                if (player.auras.deepwounds2 && player.auras.deepwounds2.timer && (player.auras.deepwounds2.nexttick - step) < next)
                    next = player.auras.deepwounds2.nexttick - step;
                if (player.auras.deepwounds3 && player.auras.deepwounds3.timer && (player.auras.deepwounds3.nexttick - step) < next)
                    next = player.auras.deepwounds3.nexttick - step;
                if (player.auras.deepwounds4 && player.auras.deepwounds4.timer && (player.auras.deepwounds4.nexttick - step) < next)
                    next = player.auras.deepwounds4.nexttick - step;
            }
            if (player.auras.weaponbleedmh && player.auras.weaponbleedmh.timer && (player.auras.weaponbleedmh.interval - ((step - player.auras.weaponbleedmh.starttimer) % player.auras.weaponbleedmh.interval)) < next)
                next = player.auras.weaponbleedmh.interval - ((step - player.auras.weaponbleedmh.starttimer) % player.auras.weaponbleedmh.interval);
            if (player.auras.weaponbleedoh && player.auras.weaponbleedoh.timer && (player.auras.weaponbleedoh.interval - ((step - player.auras.weaponbleedoh.starttimer) % player.auras.weaponbleedoh.interval)) < next)
                next = player.auras.weaponbleedoh.interval - ((step - player.auras.weaponbleedoh.starttimer) % player.auras.weaponbleedoh.interval);

            // Spells used by player
            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && player.spells.bloodthirst.timer < next) next = player.spells.bloodthirst.timer;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && player.spells.mortalstrike.timer < next) next = player.spells.mortalstrike.timer;
            if (player.spells.shieldslam && player.spells.shieldslam.timer && player.spells.shieldslam.timer < next) next = player.spells.shieldslam.timer;
            if (player.spells.quickstrike && player.spells.quickstrike.timer && player.spells.quickstrike.timer < next) next = player.spells.quickstrike.timer;
            if (player.spells.ragingblow && player.spells.ragingblow.timer && player.spells.ragingblow.timer < next) next = player.spells.ragingblow.timer;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && player.spells.whirlwind.timer < next) next = player.spells.whirlwind.timer;
            if (player.spells.shockwave && player.spells.shockwave.timer && player.spells.shockwave.timer < next) next = player.spells.shockwave.timer;
            if (player.spells.blademasterfury && player.spells.blademasterfury.timer && player.spells.blademasterfury.timer < next) next = player.spells.blademasterfury.timer;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && player.spells.bloodrage.timer < next) next = player.spells.bloodrage.timer;
            if (player.spells.ragepotion && player.spells.ragepotion.timer && player.spells.ragepotion.timer < next) next = player.spells.ragepotion.timer;
            if (player.spells.overpower && player.spells.overpower.timer && player.spells.overpower.timer < next) next = player.spells.overpower.timer;
            if (player.spells.execute && player.spells.execute.timer && player.spells.execute.timer < next) next = player.spells.execute.timer;
            if (player.spells.slam && player.spells.slam.timer && player.spells.slam.timer < next) next = player.spells.slam.timer;

            if (!player.spells.execute || (step < this.executestep && (!player.auras.suddendeath || !player.auras.suddendeath.timer))) {
                if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue) {
                    let timeleft = Math.max(player.mh.timer - player.spells.heroicstrike.unqueuetimer);
                    if (timeleft > 0 && timeleft < next) next = timeleft;
                }
                else if (player.spells.cleave && player.spells.cleave.unqueue) {
                    let timeleft = Math.max(player.mh.timer - player.spells.cleave.unqueuetimer);
                    if (timeleft > 0 && timeleft < next) next = timeleft;
                }
            }

            step += next;
            if (step > this.maxsteps) break;
            player.mh.step(next);
            if (player.oh) player.oh.step(next);

            // Determine if a spell check should happen next step
            canSpellQueue = false;
            if (player.timer && player.steptimer(next) && !player.spelldelay) { spellcheck = true; canSpellQueue = player.spellqueueing; }
            if (player.itemtimer && player.stepitemtimer(next) && !player.spelldelay) spellcheck = true;
            if (player.stancetimer && player.stepstancetimer(next) && !player.spelldelay) spellcheck = true;
            if (player.ragetimer) player.stepragetimer(next);
            if (player.dodgetimer) player.stepdodgetimer(next);
            if (player.spelldelay) player.spelldelay += next;
            if (player.heroicdelay) player.heroicdelay += next;

            // Spells used by player
            if (player.spells.ragingblow && player.spells.ragingblow.timer && !player.spells.ragingblow.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.berserkerrage && player.spells.berserkerrage.timer && !player.spells.berserkerrage.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && !player.spells.bloodthirst.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && !player.spells.mortalstrike.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.shieldslam && player.spells.shieldslam.timer && !player.spells.shieldslam.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.quickstrike && player.spells.quickstrike.timer && !player.spells.quickstrike.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && !player.spells.whirlwind.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.shockwave && player.spells.shockwave.timer && !player.spells.shockwave.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.blademasterfury && player.spells.blademasterfury.timer && !player.spells.blademasterfury.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && !player.spells.bloodrage.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.ragepotion && player.spells.ragepotion.timer && !player.spells.ragepotion.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.overpower && player.spells.overpower.timer && !player.spells.overpower.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.execute && player.spells.execute.timer && !player.spells.execute.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.hamstring && player.spells.hamstring.timer && !player.spells.hamstring.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.thunderclap && player.spells.thunderclap.timer && !player.spells.thunderclap.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.sunderarmor && player.spells.sunderarmor.timer && !player.spells.sunderarmor.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.slam && player.spells.slam.timer && !player.spells.slam.step(next) && !player.spelldelay) spellcheck = true;

            // Auras with periodic ticks
            if (player.auras.bloodrage && player.auras.bloodrage.timer && !player.auras.bloodrage.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.gabbar && player.auras.gabbar.timer) player.auras.gabbar.step();
            if (player.auras.rend && player.auras.rend.timer && !player.auras.rend.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.deepwounds && player.auras.deepwounds.timer && !player.auras.deepwounds.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.weaponbleedmh && player.auras.weaponbleedmh.timer && !player.auras.weaponbleedmh.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.weaponbleedoh && player.auras.weaponbleedoh.timer && !player.auras.weaponbleedoh.step() && !player.spelldelay) spellcheck = true;
            if (player.adjacent) {
                if (player.auras.deepwounds2 && player.auras.deepwounds2.timer && !player.auras.deepwounds2.step() && !player.spelldelay) spellcheck = true;
                if (player.auras.deepwounds3 && player.auras.deepwounds3.timer && !player.auras.deepwounds3.step() && !player.spelldelay) spellcheck = true;
                if (player.auras.deepwounds4 && player.auras.deepwounds4.timer && !player.auras.deepwounds4.step() && !player.spelldelay) spellcheck = true;
            }
        }

        // Fight done
        player.endauras();

        if (player.auras.deepwounds) {
            this.idmg += player.auras.deepwounds.idmg;
        }
        if (player.auras.deepwounds2) {
            this.idmg += player.auras.deepwounds2.idmg;
        }
        if (player.auras.deepwounds3) {
            this.idmg += player.auras.deepwounds3.idmg;
        }
        if (player.auras.deepwounds4) {
            this.idmg += player.auras.deepwounds4.idmg;
        }
        if (player.auras.rend) {
            this.idmg += player.auras.rend.idmg;
        }
        if (player.auras.weaponbleedmh) {
            this.idmg += player.auras.weaponbleedmh.idmg;
        }
        if (player.auras.weaponbleedoh) {
            this.idmg += player.auras.weaponbleedoh.idmg;
        }
        if (player.spells.fireball) {
            this.idmg += player.spells.fireball.idmg;
        }
        if (player.spells.gunaxe) {
            this.idmg += player.spells.gunaxe.idmg;
        }
        if (player.spells.themoltencore) {
            this.idmg += player.spells.themoltencore.idmg;
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
