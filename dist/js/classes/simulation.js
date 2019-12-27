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
        this.duration = parseInt($('input[name="timesecs"]').val());
        this.startrage = parseInt($('input[name="startrage"]').val());
        this.iterations = parseInt($('input[name="simulations"]').val());
        this.idmg = 0;
        this.totaldmg = 0;
        this.mindmg = 99999;
        this.maxdmg = 0;
        this.maxcallstack = Math.min(Math.floor(this.iterations / 10), 1000);
        this.starttime = 0;
        this.endtime = 0;
        this.cb_update = callback_update;
        this.cb_finished = callback_finished;

        // steps
        this.maxsteps = this.duration * 1000;
        this.executestep = parseInt(spells[4].starttime) * 1000;
        this.bloodfurystep = parseInt(spells[11].time) * 1000;
        this.berserkingstep = parseInt(spells[10].time) * 1000;
        this.reckstep = parseInt(spells[7].time) * 1000;
        this.ragestep = parseInt(spells[13].time) * 1000;
        this.jujustep = parseInt(spells[14].time) * 1000;
        this.cloudstep = Math.max(this.duration - 30,0) * 1000;
    }
    start() {
        this.run(1);
        this.starttime = new Date().getTime();
    }
    run(iteration) {
        let step = 0;
        this.idmg = 0;
        let player = this.player;
        player.reset(this.startrage);
        while (step < this.maxsteps) {
            let next = 10;
            let batch = step % 400 == 0;

            if (player.mh.timer >= 400 && player.oh.timer >= 400)
                next = (400 - (step % 400));

            if (batch && step % 3000 <= 200 && player.talents.angermanagement)
                player.rage = player.rage >= 99 ? 100 : player.rage + 1;

            step += next;
            player.mh.step(next);
            player.oh.step(next);
            if (batch) player.step(this);

            if (player.mh.timer == 0) {
                this.idmg += player.attack(player.mh);
            }
            if (player.oh.timer == 0) {
                this.idmg += player.attack(player.oh);
            }
            
            if (batch && player.timer == 0) {

                if (player.spells.bloodrage && player.spells.bloodrage.canUse()) {
                    player.spells.bloodrage.use();
                }
                else if (player.auras.jujuflurry && player.auras.jujuflurry.canUse() && step > this.jujustep) {
                    player.auras.jujuflurry.use();
                }
                else if (player.auras.mightyragepotion && player.auras.mightyragepotion.canUse() && step > this.ragestep) {
                    player.auras.mightyragepotion.use();
                }
                else if (player.auras.cloudkeeper && player.auras.cloudkeeper.canUse() && step > this.cloudstep) {
                    player.auras.cloudkeeper.use();
                }
                else if (player.spells.sunderarmor && player.spells.sunderarmor.canUse()) {
                    this.idmg += player.cast(player.spells.sunderarmor);
                }
                else if (player.auras.deathwish && player.auras.deathwish.canUse(step)) {
                    player.auras.deathwish.use();
                }
                else if (player.auras.bloodfury && player.auras.bloodfury.canUse() && step > this.bloodfurystep) {
                    player.auras.bloodfury.use();
                }
                else if (player.auras.berserking && player.auras.berserking.canUse() && step > this.berserkingstep) {
                    player.auras.berserking.use();
                }
                else if (player.auras.recklessness && player.auras.recklessness.canUse() && step > this.reckstep) {
                    player.auras.recklessness.use();
                }
                else if (player.spells.execute && step > this.executestep) {
                    if (player.spells.execute.canUse())
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
            }

            if (player.extraattacks > 0) {
                player.mh.timer = 0;
                player.extraattacks--;
            }
        }

        this.totaldmg += this.idmg;
        if (this.idmg < this.mindmg) this.mindmg = this.idmg;
        if (this.idmg > this.maxdmg) this.maxdmg = this.idmg;

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