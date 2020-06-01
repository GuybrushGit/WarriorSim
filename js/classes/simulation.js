var RESULT = {
    HIT: 0,
    MISS: 1,
    DODGE: 2,
    CRIT: 3,
    GLANCE: 4
}

var step = 0;
var log = false;
var version = 3;

class Simulation {
    constructor(player, callback_finished, callback_update) {
        this.player = player;
        this.timesecsmin = parseInt($('input[name="timesecsmin"]').val());
        this.timesecsmax = parseInt($('input[name="timesecsmax"]').val());
        this.executeperc = parseInt($('input[name="executeperc"]').val());
        this.startrage = parseInt($('input[name="startrage"]').val());
        this.iterations = parseInt($('input[name="simulations"]').val());
        this.idmg = 0;
        this.totaldmg = 0;
        this.totalduration = 0;
        this.mindps = 99999;
        this.maxdps = 0;
        this.maxcallstack = Math.min(Math.floor(this.iterations / 10), 1000);
        this.starttime = 0;
        this.endtime = 0;
        this.cb_update = callback_update;
        this.cb_finished = callback_finished;
        this.spread = [];
        this.priorityap = parseInt(spells[4].priorityap);

        if (this.iterations == 1) log = true;
        else log = false;
    }
    start() {
        this.run(1);
        this.starttime = new Date().getTime();
    }
    run(iteration) {
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

        // item steps
        let itemdelay = 0;
        if (player.auras.flask) { this.flaskstep = Math.max(this.maxsteps - 60000, 0); itemdelay += 60000; }
        if (player.auras.cloudkeeper) { this.cloudstep = Math.max(this.maxsteps - itemdelay - 30000, 0); itemdelay += 30000; }
        if (player.auras.slayer) { this.slayerstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.spider) { this.spiderstep = Math.max(this.maxsteps - itemdelay - 15000, 0); itemdelay += 15000; }
        if (player.auras.gabbar) { this.gabbarstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.earthstrike) { this.earthstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }
        if (player.auras.pummeler) { this.pummelstep = Math.max(this.maxsteps - itemdelay - 30000, 0); itemdelay += 30000; }
        if (player.auras.zandalarian) { this.zandalarstep = Math.max(this.maxsteps - itemdelay - 20000, 0); itemdelay += 20000; }

        if (player.auras.deathwish) { player.auras.deathwish.usestep = Math.max(this.maxsteps - player.auras.deathwish.timetoend, 0); }
        if (player.auras.recklessness) { player.auras.recklessness.usestep = Math.max(this.maxsteps - player.auras.recklessness.timetoend, 0); }
        if (player.auras.mightyragepotion) { player.auras.mightyragepotion.usestep = Math.max(this.maxsteps - player.auras.mightyragepotion.timetoend, 0); }
        if (player.auras.berserking) { player.auras.berserking.usestep = Math.max(this.maxsteps - player.auras.berserking.timetoend, 0); }
        if (player.auras.bloodfury) { player.auras.bloodfury.usestep = Math.max(this.maxsteps - player.auras.bloodfury.timetoend, 0); }
        if (player.auras.swarmguard) { player.auras.swarmguard.usestep = Math.max(this.maxsteps - player.auras.swarmguard.timetoend, 0); }


        //if (log) console.log(' TIME |   RAGE | EVENT')

        while (step < this.maxsteps) {

            // Passive ticks
            if (next != 0 && step % 3000 == 0 && player.talents.angermanagement) {
                player.rage = player.rage >= 99 ? 100 : player.rage + 1;
                spellcheck = true;
                //if (log) player.log(`Anger Management tick`);
            }
            if (player.vaelbuff && next != 0 && step % 1000 == 0) {
                player.rage = player.rage >= 80 ? 100 : player.rage + 20;
                spellcheck = true;
                //if (log) player.log(`Vael Buff tick`);
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

                // No GCD
                if (player.auras.swarmguard && player.auras.swarmguard.canUse()) { player.spelldelay = 1; delayedspell = player.auras.swarmguard; }
                else if (player.auras.mightyragepotion && player.auras.mightyragepotion.canUse()) { player.spelldelay = 1; delayedspell = player.auras.mightyragepotion; }
                else if (player.spells.bloodrage && player.spells.bloodrage.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodrage; }
                
                // GCD spells
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
                    if (player.spells.bloodthirst && player.stats.ap >= this.priorityap && player.spells.bloodthirst.canUse()) {
                        player.spelldelay = 1; delayedspell = player.spells.bloodthirst;
                    }
                    else if (player.spells.mortalstrike && player.stats.ap >= this.priorityap && player.spells.mortalstrike.canUse()) {
                        player.spelldelay = 1; delayedspell = player.spells.mortalstrike;
                    }
                    else if (player.spells.execute.canUse()) {
                        player.spelldelay = 1; delayedspell = player.spells.execute;
                    }
                }

                // Normal phase
                else if (player.spells.sunderarmor && player.spells.sunderarmor.canUse()) { player.spelldelay = 1; delayedspell = player.spells.sunderarmor; }
                else if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) { player.spelldelay = 1; delayedspell = player.spells.bloodthirst; }
                else if (player.spells.mortalstrike && player.spells.mortalstrike.canUse()) { player.spelldelay = 1; delayedspell = player.spells.mortalstrike; }
                else if (player.spells.whirlwind && player.spells.whirlwind.canUse()) { player.spelldelay = 1; delayedspell = player.spells.whirlwind; }
                else if (player.spells.overpower && player.spells.overpower.canUse()) { player.spelldelay = 1; delayedspell = player.spells.overpower; }
                else if (player.spells.hamstring && player.spells.hamstring.canUse()) { player.spelldelay = 1; delayedspell = player.spells.hamstring; }

                //if (log && player.spelldelay) player.log(`Preparing ${delayedspell.name}`);

                if (player.heroicdelay) spellcheck = false;
            }

            // Heroic Strike
            if (spellcheck && !player.heroicdelay) {
                if (!player.spells.execute || step < this.executestep) {
                    if (player.spells.heroicstrike && player.spells.heroicstrike.canUse()) { player.heroicdelay = 1; delayedheroic = player.spells.heroicstrike; }
                }
                else {
                    if (player.spells.heroicstrikeexecute && player.spells.heroicstrikeexecute.canUse()) { player.heroicdelay = 1; delayedheroic = player.spells.heroicstrikeexecute; }
                }

                //if (log && player.heroicdelay) player.log(`Preparing ${delayedheroic.name}`);

                spellcheck = false;
            }

            // Cast spells
            if (player.spelldelay && delayedspell && player.spelldelay > delayedspell.maxdelay) {

                // Prevent casting HS and other spells at the exact same time
                if (player.heroicdelay && delayedheroic && player.heroicdelay > delayedheroic.maxdelay)
                    player.heroicdelay = delayedheroic.maxdelay - 49;

                if (delayedspell.canUse()) {
                    this.idmg += player.cast(delayedspell);
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

            if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue && player.nextswinghs &&
                player.rage < player.spells.heroicstrike.unqueue && player.mh.timer <= player.spells.heroicstrike.unqueuetimer) {
                this.player.nextswinghs = false;
                //if (log) player.log(`Heroic Strike unqueued`);
            }

            // Extra attacks
            if (player.extraattacks > 0) {
                player.mh.timer = 0;
                player.extraattacks--;
            }
            if (player.batchedextras > 0) {
                player.mh.timer = 400 - (step % 400);
                player.batchedextras--;
            }
            
            // Process next step
            if (!player.mh.timer || (!player.spelldelay && spellcheck) || (!player.heroicdelay && spellcheck)) { next = 0; continue; }
            next = Math.min(player.mh.timer, player.oh ? player.oh.timer : 9999);
            if (player.spelldelay && (delayedspell.maxdelay - player.spelldelay) < next) next = delayedspell.maxdelay - player.spelldelay + 1;
            if (player.heroicdelay && (delayedheroic.maxdelay - player.heroicdelay) < next) next = delayedheroic.maxdelay - player.heroicdelay + 1;
            if (player.timer && player.timer < next) next = player.timer;
            if (player.itemtimer && player.itemtimer < next) next = player.itemtimer;
            if (player.talents.angermanagement && (3000 - (step % 3000)) < next) next = 3000 - (step % 3000);
            if (player.vaelbuff && (1000 - (step % 1000)) < next) next = 1000 - (step % 1000);
            if (player.auras.bloodrage && player.auras.bloodrage.timer && (1000 - ((step - player.auras.bloodrage.starttimer) % 1000)) < next)
                next = 1000 - ((step - player.auras.bloodrage.starttimer) % 1000);
            if (player.auras.gabbar && player.auras.gabbar.timer && (2000 - ((step - player.auras.gabbar.starttimer) % 2000)) < next)
                next = 2000 - ((step - player.auras.gabbar.starttimer) % 2000);

            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && player.spells.bloodthirst.timer < next) next = player.spells.bloodthirst.timer;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && player.spells.mortalstrike.timer < next) next = player.spells.mortalstrike.timer;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && player.spells.whirlwind.timer < next) next = player.spells.whirlwind.timer;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && player.spells.bloodrage.timer < next) next = player.spells.bloodrage.timer;
            if (player.spells.overpower && player.spells.overpower.timer && player.spells.overpower.timer < next) next = player.spells.overpower.timer;
            if (player.spells.execute && player.spells.execute.timer && player.spells.execute.timer < next) next = player.spells.execute.timer;

            if (player.spells.heroicstrike && player.spells.heroicstrike.unqueue) {
                let timeleft = Math.max(player.mh.timer - player.spells.heroicstrike.unqueuetimer);
                if (timeleft > 0 && timeleft < next) next = timeleft;
            }

            // if (next == 0) { debugger; break; } // Something went wrong!
            step += next;
            player.mh.step(next);
            if (player.oh) player.oh.step(next);
            if (player.timer && player.steptimer(next) && !player.spelldelay) spellcheck = true;
            if (player.itemtimer && player.stepitemtimer(next) && !player.spelldelay) spellcheck = true;
            if (player.dodgetimer) player.stepdodgetimer(next);
            if (player.spelldelay) player.spelldelay += next;
            if (player.heroicdelay) player.heroicdelay += next;

            if (player.spells.bloodthirst && player.spells.bloodthirst.timer && !player.spells.bloodthirst.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.mortalstrike && player.spells.mortalstrike.timer && !player.spells.mortalstrike.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.whirlwind && player.spells.whirlwind.timer && !player.spells.whirlwind.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.bloodrage && player.spells.bloodrage.timer && !player.spells.bloodrage.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.overpower && player.spells.overpower.timer && !player.spells.overpower.step(next) && !player.spelldelay) spellcheck = true;
            if (player.spells.execute && player.spells.execute.timer && !player.spells.execute.step(next) && !player.spelldelay) spellcheck = true;

            if (player.auras.bloodrage && player.auras.bloodrage.timer && !player.auras.bloodrage.step() && !player.spelldelay) spellcheck = true;
            if (player.auras.gabbar && player.auras.gabbar.timer) player.auras.gabbar.step();
        }

        // Fight done
        player.endauras();

        this.totaldmg += this.idmg;
        this.totalduration += this.duration;
        let dps = this.idmg / this.duration;
        if (dps < this.mindps) this.mindps = dps;
        if (dps > this.maxdps) this.maxdps = dps;
        dps = Math.round(dps);
        if (!this.spread[dps]) this.spread[dps] = 1;
        else this.spread[dps]++;

        if (iteration == this.iterations) {
            this.endtime = new Date().getTime();
            if (this.cb_finished)
                this.cb_finished();
        }
        else if (iteration % this.maxcallstack == 0) {
            let view = this;
            if (this.cb_update)
                this.cb_update(iteration);
            setTimeout(function () { view.run(iteration + 1); }, 0);
        }
        else {
            this.run(iteration + 1);
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
