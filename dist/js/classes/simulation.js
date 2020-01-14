var RESULT = {
    HIT: 0,
    MISS: 1,
    DODGE: 2,
    CRIT: 3,
    GLANCE: 4
}

class Simulation {
    constructor(player, callback_finished, callback_update) {
        this.player = player;
        this.timesecsmin = parseInt($('input[name="timesecsmin"]').val());
        this.timesecsmax = parseInt($('input[name="timesecsmax"]').val());
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
        this.player.simulation = this;
        this.spread = [];

        // this.steps
        this.bloodfurystep = parseInt(spells[11].time) * 1000;
        this.berserkingstep = parseInt(spells[10].time) * 1000;
        this.reckstep = parseInt(spells[7].time) * 1000;
        this.jujustep = parseInt(spells[14].time) * 1000;
        this.priorityap = parseInt(spells[4].priorityap);
    }
    start() {
        this.run(1);
        this.starttime = new Date().getTime();
    }
    run(iteration) {
        this.step = 1;
        this.idmg = 0;
        let player = this.player;
        player.reset(this.startrage);
        this.maxsteps = rng(this.timesecsmin * 1000, this.timesecsmax * 1000);
        this.duration = this.maxsteps / 1000;
        this.executestep = Math.max(this.maxsteps - parseInt(spells[4].lasttime) * 1000, 0);
        this.fifteenstep = Math.max(this.maxsteps - 16000,0);
        this.twentystep = Math.max(this.maxsteps - 21000,0);
        this.thirtystep = Math.max(this.maxsteps - 31000,0);
        this.sixtystep = Math.max(this.maxsteps - 61000,0);
        while (this.step < this.maxsteps) {
            let next;
            let nextbatch = 400 - (this.step % 400);
  
            if (player.mh.timer >= nextbatch && (!player.oh || player.oh.timer >= nextbatch))
                next = nextbatch;
            else
                next = Math.min(player.mh.timer, player.oh ? player.oh.timer : 9999);

            this.step += next;
            let batch = this.step % 400 == 0;
            if (batch && this.step % 3000 <= 200 && player.talents.angermanagement)
                player.rage = player.rage >= 99 ? 100 : player.rage + 1;

            player.mh.step(next);
            if (player.oh) player.oh.step(next);
            if (batch) player.step(this);

            if (player.mh.timer == 0) {
                this.idmg += player.attackmh(player.mh, player.nextswingwf);
            }
            if (player.oh && player.oh.timer == 0) {
                this.idmg += player.attackoh(player.oh);
            }

            if (batch && player.timer == 0) {

                if (player.spells.bloodrage && player.spells.bloodrage.canUse()) {
                    player.spells.bloodrage.use();
                }
                else if (player.auras.jujuflurry && player.auras.jujuflurry.canUse() && this.step > this.jujustep) {
                    player.auras.jujuflurry.use();
                }
                else if (player.auras.mightyragepotion && player.auras.mightyragepotion.canUse(this.step)) {
                    player.auras.mightyragepotion.use();
                }
                else if (player.auras.cloudkeeper && player.auras.cloudkeeper.canUse() && this.step > this.thirtystep) {
                    player.auras.cloudkeeper.use();
                }
                else if (player.auras.flask && player.auras.flask.canUse() && this.step > this.sixtystep) {
                    player.auras.flask.use();
                }
                else if (player.auras.slayer && player.auras.slayer.canUse() && this.step > this.twentystep) {
                    player.auras.slayer.use();
                }
                else if (player.auras.spider && player.auras.spider.canUse() && this.step > this.fifteenstep) {
                    player.auras.spider.use();
                }
                else if (player.auras.gabbar && player.auras.gabbar.canUse() && this.step > this.twentystep) {
                    player.auras.gabbar.use();
                }
                else if (player.auras.earthstrike && player.auras.earthstrike.canUse() && this.step > this.twentystep) {
                    player.auras.earthstrike.use();
                }
                else if (player.auras.pummeler && player.auras.pummeler.canUse() && this.step > this.thirtystep) {
                    player.auras.pummeler.use();
                }
                else if (player.spells.sunderarmor && player.spells.sunderarmor.canUse()) {
                    this.idmg += player.cast(player.spells.sunderarmor);
                }
                else if (player.auras.deathwish && player.auras.deathwish.canUse(this.step)) {
                    player.auras.deathwish.use();
                }
                else if (player.auras.bloodfury && player.auras.bloodfury.canUse() && this.step > this.bloodfurystep) {
                    player.auras.bloodfury.use();
                }
                else if (player.auras.berserking && player.auras.berserking.canUse() && this.step > this.berserkingstep) {
                    player.auras.berserking.use();
                }
                else if (player.auras.recklessness && player.auras.recklessness.canUse() && this.step > this.reckstep) {
                    player.auras.recklessness.use();
                }
                else if (player.spells.execute && this.step > this.executestep) {
                    if (player.spells.bloodthirst && player.stats.ap >= this.priorityap && player.spells.bloodthirst.canUse()) {
                        this.idmg += player.cast(player.spells.bloodthirst);
                    }
                    else if (player.spells.mortalstrike && player.stats.ap >= this.priorityap && player.spells.mortalstrike.canUse()) {
                        this.idmg += player.cast(player.spells.mortalstrike);
                    }
                    else if (player.spells.execute.canUse())
                        this.idmg += player.cast(player.spells.execute);
                }
                else if (player.spells.overpower && player.spells.overpower.canUse()) {
                    this.idmg += player.cast(player.spells.overpower);
                }
                else if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) {
                    this.idmg += player.cast(player.spells.bloodthirst);
                }
                else if (player.spells.mortalstrike && player.spells.mortalstrike.canUse()) {
                    this.idmg += player.cast(player.spells.mortalstrike);
                }
                else if (player.spells.heroicstrike && player.spells.heroicstrike.canUse()) {
                    player.spells.heroicstrike.use();
                }
                else if (player.spells.whirlwind && player.spells.whirlwind.canUse()) {
                    this.idmg += player.cast(player.spells.whirlwind);
                }
                else if (player.spells.hamstring && player.spells.hamstring.canUse()) {
                    this.idmg += player.cast(player.spells.hamstring);
                }
            }

            if (batch && player.spells.heroicstrike && player.mh.timer <= 400 && player.rage < player.spells.heroicstrike.unqueue) {
                this.player.nextswinghs = false;
            }

            if (player.extraattacks > 0) {
                player.mh.timer = 0;
                player.extraattacks--;
            }
        }

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