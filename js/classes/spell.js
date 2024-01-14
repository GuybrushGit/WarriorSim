class Spell {
    constructor(player, id, name) {
        this.id = id;
        this.timer = 0;
        this.cost = 0;
        this.cooldown = 0;
        this.player = player;
        this.refund = true;
        this.canDodge = true;
        this.totaldmg = 0;
        this.data = [0, 0, 0, 0, 0];
        this.name = name || this.constructor.name;
        this.useonly = false;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        this.weaponspell = true;
        this.minrage = 0;

        let spell = spells.filter(s => s.id == this.id)[0];
        if (!spell) return;
        if (spell.minrageactive) this.minrage = parseInt(spell.minrage);
        if (spell.maxrageactive) this.maxrage = parseInt(spell.maxrage);
        if (spell.maincdactive) this.maincd = parseInt(spell.maincd) * 1000;
        if (spell.cooldown) this.cooldown = parseInt(spell.cooldown) || 0;
        if (spell.durationactive) this.cooldown = Math.max(parseInt(spell.duration), this.cooldown);
        if (spell.value1) this.value1 = parseInt(spell.value1);
        if (spell.value2) this.value2 = parseInt(spell.value2);
        if (spell.priorityapactive) this.priorityap = parseInt(spell.priorityap);
        if (spell.flagellation) this.flagellation = spell.flagellation;
        if (spell.consumedrage) this.consumedrage = spell.consumedrage;
        if (spell.unqueueactive) this.unqueue = parseInt(spell.unqueue);
        if (spell.exmacro) this.exmacro = spell.exmacro;
        if (spell.execute) this.execute = spell.execute;
        if (spell.globalsactive) this.globals = spell.globals;
    }
    dmg() {
        return 0;
    }
    use() {
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    step(a) {
        if (this.timer <= a) {
            this.timer = 0;
            /* start-log */ if (log) this.player.log(`${this.name} off cooldown`); /* end-log */
        }
        else {
            this.timer -= a;
        }
        return this.timer;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
    failed() {}
}

class Bloodthirst extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 30;
        this.cooldown = 6;
        this.weaponspell = false;
    }
    dmg() {
        return this.player.stats.ap * 0.45;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
}

class Whirlwind extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 25;
        this.cooldown = 10;
        this.refund = false;
    }
    dmg() {
        let dmg;
        dmg = rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return dmg + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && 
        ((!this.minrage && !this.maincd) ||
         (this.minrage && this.player.rage >= this.minrage) ||
         (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
         (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class Overpower extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 5;
        this.cooldown = 5;
        this.canDodge = false;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return dmg + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    use() {
        this.player.timer = 1500;
        this.player.dodgetimer = 0;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.stance && !this.player.gladstance) {
            this.player.auras.battlestance.use();
            this.player.rage = Math.min(this.player.rage, this.player.talents.rageretained);
        }
        this.player.rage -= this.cost;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.dodgetimer &&
        ((!this.maxrage && !this.maincd) ||
         (this.maxrage && this.player.rage <= this.maxrage) ||
         (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
         (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class Execute extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 15 - player.talents.executecost;
        this.usedrage = 0;
        this.totalusedrage = 0;
        this.refund = false;
        this.weaponspell = false;
    }
    dmg() {
        return this.value1 + (this.value2 * this.usedrage);
    }
    use(delayedheroic) {
        // HS + Execute macro
        if (delayedheroic && delayedheroic.exmacro) {
            if (delayedheroic.canUse()) {
                this.player.cast(delayedheroic);
                this.player.heroicdelay = 0;
            }
            else if (delayedheroic instanceof Cleave && delayedheroic.backupheroic && delayedheroic.backupheroic.canUse()) {
                this.player.cast(delayedheroic.backupheroic);
                this.player.heroicdelay = 0;
            }
        }

        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.usedrage = ~~this.player.rage;
        this.totalusedrage += this.usedrage;
        this.timer = batching - (step % batching);
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    step(a) {
        if (this.timer <= a) {
            this.timer = 0;
            if (this.result != RESULT.MISS && this.result != RESULT.DODGE)
                this.player.rage = 0;
            /* start-log */ if (log) this.player.log(`Execute batch (${Object.keys(RESULT)[this.result]})`); /* end-log */
        }
        else {
            this.timer -= a;
        }
        return this.timer;
    }
    canUse() {
        return !this.player.timer && this.cost <= this.player.rage;
    }
}

class Bloodrage extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 0;
        this.rage = 10 + player.talents.bloodragebonus;
        this.cooldown = 60;
        this.useonly = true;
    }
    use() {
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + this.rage, 100);
        this.player.auras.bloodrage.use();
        this.player.auras.flagellation && this.player.auras.flagellation.use();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0 && 
            (!this.flagellation || !this.player.auras.bloodrage || !this.player.auras.bloodrage.timer) &&
            (!this.consumedrage || !this.player.auras.consumedrage || this.player.auras.consumedrage.timer);
    }
}

class HeroicStrike extends Spell {
    constructor(player, id) {
        super(player, id, "Heroic Strike");
        this.cost = 15 - player.talents.impheroicstrike;
        this.bonus = this.value1;
        this.useonly = true;
        this.unqueuetimer = 300 + rng(this.player.reactionmin, this.player.reactionmax);
    }
    use() {
        this.player.nextswinghs = true;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        this.unqueuetimer = 300 + rng(this.player.reactionmin, this.player.reactionmax);
    }
    canUse() {
        return !this.player.nextswinghs && this.cost <= this.player.rage && 
            ((!this.minrage && !this.maincd) ||
            (this.minrage && this.player.rage >= this.minrage) ||
            (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd))
            && (!this.unqueue || (this.player.mh.timer > this.unqueuetimer));
    }
}

class Cleave extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 20;
        this.bonus = this.value1;
        this.useonly = true;
        this.unqueuetimer = 300 + rng(this.player.reactionmin, this.player.reactionmax);

        if (this.exmacro) {
            for (let spell of spells) {
                let min = parseInt(spell.minlevel || 0);
                let max = parseInt(spell.maxlevel || 60);
                if (spell.name == "Heroic Strike" && player.level >= min && player.level <= max) {
                    this.backupheroic = new HeroicStrike(player, spell.id);
                    this.backupheroic.exmacro = true;
                }
            }
        }
    }
    use() {
        this.player.nextswinghs = true;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        this.unqueuetimer = 300 + rng(this.player.reactionmin, this.player.reactionmax);
    }
    canUse() {
        return !this.player.nextswinghs && this.cost <= this.player.rage && 
            ((!this.minrage && !this.maincd) ||
            (this.minrage && this.player.rage >= this.minrage) ||
            (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd))
            && (!this.unqueue || (this.player.mh.timer > this.unqueuetimer));
    }
}

class MortalStrike extends Spell {
    constructor(player, id) {
        super(player, id, 'Mortal Strike');
        this.cost = 30;
        this.cooldown = 6;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return dmg + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
}

class SunderArmor extends Spell {
    constructor(player, id) {
        super(player, id, 'Sunder Armor');
        this.cost = 15 - player.talents.impsunderarmor;
        this.stacks = 0;
        this.nocrit = true;
    }
    use() {
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.stacks = Math.min(6, this.stacks + 1);
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    dmg() {
        if (!this.devastate) return 0;
        let dmg;
        let mod = 0.6 + 0.06 * (this.stacks - 1);
        dmg = rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return (dmg + (this.player.stats.ap / 14) * this.player.mh.normSpeed) * mod;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage &&
            (!this.minrage || this.player.rage >= this.minrage) &&
            (!this.globals || this.stacks < this.globals);
    }
    failed() {
        this.stacks--;
    }
}

class Hamstring extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 10;
        if (player.items.includes(19577)) this.cost -= 2;
    }
    dmg() {
        return this.value1;
    }
}

class VictoryRush extends Spell {
    constructor(player, id) {
        super(player, id, 'Victory Rush');
        this.cost = 0;
        this.stacks = 0;
        this.weaponspell = false;
    }
    use() {
        this.stacks++;
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    dmg() {
        return this.player.stats.ap * 0.45;
    }
    canUse() {
        return !this.player.timer && !this.stacks;
    }
}

class RagingBlow extends Spell {
    constructor(player, id) {
        super(player, id, 'Raging Blow');
        this.cost = 0;
        this.cooldown = 8;
    }
    dmg() {
        let dmg;
        dmg = rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return dmg + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse(executephase) {
        return !this.timer && !this.player.timer && 
            (!executephase || this.execute) &&
            ((this.player.auras.bloodrage && this.player.auras.bloodrage.timer) 
              || (this.player.auras.berserkerrage && this.player.auras.berserkerrage.timer)
              || (this.player.auras.consumedrage && this.player.auras.consumedrage.timer));
    }
}

class BerserkerRage extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 0;
        this.rage = player.talents.berserkerbonus;
        this.cooldown = 30;
        this.useonly = true;
    }
    use() {
        this.player.timer = 1500;
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + this.rage, 100);
        this.player.auras.berserkerrage.use();
        this.player.auras.flagellation && this.player.auras.flagellation.use();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0 && !this.player.timer &&
            (!this.flagellation || !this.player.auras.bloodrage || !this.player.auras.bloodrage.timer) &&
            (!this.consumedrage || !this.player.auras.consumedrage || this.player.auras.consumedrage.timer);
    }
}

class QuickStrike extends Spell {
    constructor(player, id) {
        super(player, id, 'Quick Strike');
        this.cost = 20 - player.talents.impheroicstrike;
        this.cooldown = 0;
    }
    dmg() {
        return ~~rng(this.player.stats.ap * 0.15, this.player.stats.ap * 0.25);
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
}

class RagePotion extends Spell {
    constructor(player, id) {
        super(player, id, 'Rage Potion');
        this.cost = 0;
        this.rage = 100;
        this.minrage = 80;
        this.cooldown = 120;
        this.useonly = true;
    }
    use() {
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + ~~rng(this.value1, this.value2), 100);
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0 && this.player.rage < this.minrage;
    }
}

class Slam extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 15;
        this.casttime = 1500 - (player.talents.impslam * 100);
        this.mhthreshold = player.mh.speed * 1000;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        return dmg + (this.player.stats.ap / 14) * this.player.mh.speed;
    }
    use() {
        this.player.rage -= this.cost;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        this.player.mh.use();
        if (this.player.oh) this.player.oh.use();
        /* start-log */ if (log) this.player.log(`${this.name} done casting`); /* end-log */
    }
    canUse() {
        return !this.player.timer && this.player.mh.timer > this.mhthreshold && this.cost <= this.player.rage && 
            (!this.player.auras.battlestance || !this.player.auras.battlestance.timer) &&
            ((!this.minrage && !this.maincd) ||
            (this.minrage && this.player.rage >= this.minrage) ||
            (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

/**************************************************** AURAS ****************************************************/

class Aura {
    constructor(player, id, name) {
        this.id = id;
        this.timer = 0;
        this.starttimer = 0;
        this.stats = {};
        this.mult_stats = {};
        this.player = player;
        this.firstuse = true;
        this.duration = 0;
        this.stacks = 0;
        this.uptime = 0;
        this.name = name || this.constructor.name;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        this.useonly = true;

        let spell = spells.filter(s => s.id == this.id)[0];
        if (!spell) spell = buffs.filter(s => s.id == this.id)[0];
        if (!spell) return;
        if (spell.durationactive) this.duration = parseInt(spell.duration);
        if (spell.timetoend) this.timetoend = parseInt(spell.timetoend) * 1000;
        if (spell.crusaders) this.crusaders = parseInt(spell.crusaders);
        if (spell.haste) this.mult_stats = { haste: parseInt(spell.haste) };
        if (spell.value1) this.value1 = spell.value1;
        if (spell.value2) this.value2 = spell.value2;
        if (spell.procblock) this.procblock = spell.procblock;
        if (spell.rageblockactive) this.rageblock = parseInt(spell.rageblock);
        if (spell.erageblockactive) this.erageblock = parseInt(spell.erageblock);
        if (spell.chargeblockactive) this.chargeblock = parseInt(spell.chargeblock);
        if (spell.echargeblockactive) this.echargeblock = parseInt(spell.echargeblock);
        if (spell.wfap) this.wfap = parseInt(spell.wfap);
        if (spell.wfapperc) this.wfapperc = parseInt(spell.wfapperc);

    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAuras();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
    }
}

class Recklessness extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 15;
        this.stats = { crit: 100 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.player.timer = 1500;
        this.starttimer = step;
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && step >= this.usestep;
    }
}

class Flurry extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 12;
        this.mult_stats = { haste: player.talents.flurry };
    }
    proc() {
        this.stacks--;
        if (!this.stacks) {
            this.uptime += step - this.starttimer;
            this.timer = 0;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    use() {
        this.timer = 1;
        if (!this.stacks) {
            this.starttimer = step;
            this.player.updateHaste();
        }
        this.stacks = 3;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class DeepWounds extends Aura {
    constructor(player, id, adjacent) {
        super(player, id, 'Deep Wounds' + (adjacent ? ' ' + adjacent : ''));
        this.duration = 12;
        this.idmg = 0;
        this.totaldmg = 0;
        this.saveddmg = 0;
        this.ticksleft = 0;
    }
    tickdmg() {
        let min = this.player.mh.mindmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
        let max = this.player.mh.maxdmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
        let dmg = (min + max) / 2;
        dmg *= this.player.mh.modifier * this.player.stats.dmgmod * this.player.talents.deepwounds * (this.player.bleedmod || 1); 
        return dmg;
    }
    step() {
        while (step >= this.nexttick) {
            let dmg = this.saveddmg / this.ticksleft;
            this.saveddmg -= dmg;
            dmg *= this.player.mh.modifier * this.player.stats.dmgmod;
            this.idmg += dmg;
            this.totaldmg += dmg;
            this.ticksleft--;

            if (this.player.bleedrage) {
                let oldRage = this.player.rage;
                this.player.rage += this.player.bleedrage;
                if (this.player.rage > 100) this.player.rage = 100;
                if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
                    this.player.auras.consumedrage.use();
            }

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${dmg.toFixed(2)}`); /* end-log */

            this.nexttick += 3000;
        }

        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
        }
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.ticksleft = 4;
        this.saveddmg += this.tickdmg();
        this.nexttick = step + 3000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class OldDeepWounds extends Aura {
    constructor(player, id, adjacent) {
        super(player, id, 'Deep Wounds' + (adjacent ? ' ' + adjacent : ''));
        this.duration = 12;
        this.idmg = 0;
        this.totaldmg = 0;
    }
    step() {
        while (step >= this.nexttick) {
            let min = this.player.mh.mindmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
            let max = this.player.mh.maxdmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
            let dmg = (min + max) / 2;
            dmg *= this.player.mh.modifier * this.player.stats.dmgmod * this.player.talents.deepwounds * (this.player.bleedmod || 1);
            this.idmg += dmg / 4;
            this.totaldmg += dmg / 4;

            if (this.player.bleedrage) {
                let oldRage = this.player.rage;
                this.player.rage += this.player.bleedrage;
                if (this.player.rage > 100) this.player.rage = 100;
                if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
                    this.player.auras.consumedrage.use();
            }

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${(dmg / 4).toFixed(2)}`); /* end-log */

            this.nexttick += 3000;
        }

        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
        }
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.nexttick = step + 3000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class Crusader extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 15;
        this.stats = { str: 100 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateStrength();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateStrength();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Cloudkeeper extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.stats = { ap: 100 };
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.player.itemtimer && !this.timer && !this.player.timer;
    }
}

class Felstriker extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 3;
        this.stats = { crit: 100, hit: 100 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.update();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.update();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class DeathWish extends Aura {
    constructor(player, id) {
        super(player, id, 'Death Wish');
        this.duration = 30;
        this.mult_stats = { dmgmod: 20 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.player.rage -= 10;
        this.player.timer = 1500;
        this.starttimer = step;
        this.player.updateDmgMod();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && this.player.rage >= 10 && (step >= this.usestep ||
            (this.crusaders == 1 && ((this.player.auras.crusader1 && this.player.auras.crusader1.timer) || (this.player.auras.crusader2 && this.player.auras.crusader2.timer))) ||
            (this.crusaders == 2 && this.player.auras.crusader1 && this.player.auras.crusader1.timer && this.player.auras.crusader2 && this.player.auras.crusader2.timer));
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class BattleStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Battle Stance');
        this.duration = 2;
        this.stats = { crit: -3 };
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.timer = 1500;
            this.firstuse = false;
            this.player.updateAuras();
            this.player.rage = Math.min(this.player.rage, this.player.talents.rageretained);
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class MightyRagePotion extends Aura {
    constructor(player, id) {
        super(player, id, 'Mighty Rage Potion');
        this.stats = { str: 60 };
        this.duration = 20;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + ~~rng(this.value1, this.value2), 100);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateStrength();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
            this.player.auras.consumedrage.use();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && (step >= this.usestep ||
            (this.crusaders == 1 && ((this.player.auras.crusader1 && this.player.auras.crusader1.timer) || (this.player.auras.crusader2 && this.player.auras.crusader2.timer))) ||
            (this.crusaders == 2 && this.player.auras.crusader1 && this.player.auras.crusader1.timer && this.player.auras.crusader2 && this.player.auras.crusader2.timer));
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateStrength();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class BloodFury extends Aura {
    constructor(player, id) {
        super(player, id, 'Blood Fury');
        this.duration = 15;
        this.mult_stats = { baseapmod: 25 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.timer = 1500;
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAuras();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && step >= this.usestep;
    }
}

class Berserking extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.rage -= 5;
        this.player.timer = 1500;
        this.player.updateHaste();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && this.player.rage >= 5 && step >= this.usestep;
    }
}

class Empyrean extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.mult_stats = { haste: 20 };
        this.name = 'Empyrean Haste';
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Eskhandar extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 5;
        this.mult_stats = { haste: 30 };
        this.name = 'Eskhandar Haste';
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Zeal extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 15;
        this.stats = { bonusdmg: 10 };
    }
    use() {
        if (this.player.timer && this.player.timer < 1500) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateBonusDmg();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateBonusDmg();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Annihilator extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 45;
        this.armor = 200;
        this.stacks = 0;
    }
    use() {
        if (rng10k() < this.player.target.binaryresist) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = this.stacks > 2 ? 3 : this.stacks + 1;
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Rivenspike extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.armor = 200;
        this.stacks = 0;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = this.stacks > 2 ? 3 : this.stacks + 1;
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Bonereaver extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.armor = 700;
        this.stacks = 0;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = this.stacks > 2 ? 3 : this.stacks + 1;
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Destiny extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.stats = { str: 200 };
    }
}

class Untamed extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 8;
        this.stats = { str: 300 };
        this.name = 'The Untamed Blade';
    }
}

class Pummeler extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.mult_stats = { haste: 50 };
        this.name = 'Manual Crowd Pummeler';
    }
    use() {
        this.player.timer = 1500;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
}

class Windfury extends Aura {
    constructor(player, id) {
        super(player, id);
        if (this.wfap) this.stats = { ap: this.wfap };
        if (this.wfapperc) this.mult_stats = { apmod: this.wfapperc };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + 1500;
        this.starttimer = step;
        this.mintime = step % batching;
        this.stacks = 2;
        this.player.updateAP();
        this.player.extraattacks++;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    proc() {
        if (this.stacks < 2) {
            if (step < this.mintime)
                this.timer = this.mintime;
            else
                this.step();
            this.stacks = 0;
        }
        else {
            this.stacks--;
        }
    }
    step() {
        if (step >= this.timer || this.stacks == 0) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.stacks = 0;
            this.firstuse = false;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Swarmguard extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.armor = 200;
        this.stacks = 0;
        this.chance = 5000;
        this.timetoend = 30000;
    }
    use() {
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = 0;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
    proc() {
        this.stacks = Math.min(this.stacks + 1, 6);
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} proc`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.stacks = 0;
            this.firstuse = false;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Flask extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 60;
        this.stats = { str: 75 };
        this.name = 'Diamond Flask';
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAuras();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
}

class Slayer extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.stats = { ap: 260 };
        this.name = 'Slayer\'s Crest';
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
}

class Spider extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 15;
        this.mult_stats = { haste: 20 };
        this.name = 'Kiss of the Spider';
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
}

class Earthstrike extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.stats = { ap: 280 };
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
}

class Gabbar extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.stats = { ap: 65 };
        this.name = 'Jom Gabbar';
    }
    use() {
        this.stats.ap = 65;
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
    step() {
        if ((step - this.starttimer) % 2000 == 0) {
            this.stats.ap += 65;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} tick`); /* end-log */
        }
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class PrimalBlessing extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 12;
        this.stats = { ap: 300 };
        this.name = 'Primal Blessing';
    }
}

class BloodrageAura extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.name = 'Bloodrage';
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if ((step - this.starttimer) % 1000 == 0) {
            this.player.rage = Math.min(this.player.rage + 1, 100);
            if (this.player.auras.consumedrage && this.player.rage >= 80 && this.player.rage < 81)
                this.player.auras.consumedrage.use();
            /* start-log */ if (log) this.player.log(`${this.name} tick`); /* end-log */
        }
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
        return this.timer;
    }
}

class Zandalarian extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.stats = { bonusdmg: 40 };
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stats.bonusdmg = 40;
        this.player.updateBonusDmg();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    proc() {
        this.stats.bonusdmg -= 2;
        this.player.updateBonusDmg();
        if (this.stats.bonusdmg <= 0) {
            this.timer = step;
            this.step();
        }
        //this.player.log(`${this.name} proc ${this.stats.bonusdmg} `);
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateBonusDmg();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Avenger extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.stats = { ap: 200 };
        this.name = 'Argent Avenger';
    }
}

class Flagellation extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 12;
        this.mult_stats = { dmgmod: 25 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateDmgMod();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class BerserkerRageAura extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.name = 'Berserker Rage';
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class ConsumedRage extends Aura {
    constructor(player, id) {
        super(player, id, 'Consumed by Rage');
        this.duration = 12;
        this.mult_stats = { dmgmod: 20 };
    }
    proc() {
        this.stacks--;
        if (!this.stacks) {
            this.uptime += step - this.starttimer;
            this.timer = 0;
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = 12;
        this.player.updateDmgMod();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.stacks = 0;
            this.firstuse = false;
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Rend extends Aura {
    constructor(player, id) {
        super(player, id);
        let dur = this.value2 * 3;
        this.duration = Math.max(this.duration || dur, dur);
        this.cost = 10;
        this.idmg = 0;
        this.totaldmg = 0;
        this.uses = 0;
        this.dmgmod = 1 + this.player.talents.rendmod / 100;
    }
    step() {
        while (step >= this.nexttick && this.stacks) {
            let dmg = this.value1 * this.player.stats.dmgmod * this.dmgmod * (this.player.bleedmod || 1);
            this.idmg += dmg / this.value2;
            this.totaldmg +=dmg / this.value2;

            if (this.player.bleedrage) {
                let oldRage = this.player.rage;
                this.player.rage += this.player.bleedrage;
                if (this.player.rage > 100) this.player.rage = 100;
                if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
                    this.player.auras.consumedrage.use();
            }

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${(dmg / this.value2).toFixed(2)}`); /* end-log */

            this.nexttick += 3000;
            this.stacks--;

            if (!this.stacks) {
                this.uptime += (step - this.starttimer);
                /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
            }
        }

        if (step >= this.timer) {
            this.timer = 0;
            this.firstuse = false;
        }
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.nexttick = step + 3000;
        this.timer = step + this.duration * 1000;
        this.player.timer = 1500;
        this.starttimer = step;
        this.stacks = this.value2;
        this.player.rage -= this.cost;
        this.uses++;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return !this.timer && !this.player.timer && this.player.rage >= this.cost;
    }
    end() {
        if (this.stacks)
            this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
    }
}

class Vibroblade extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.armor = 100;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class VoidMadness extends Aura {
    constructor(player, id) {
        super(player, id, 'Void Madness');
        this.duration = 10;
        this.mult_stats = { haste: 10 };
    }
    use() {
        this.player.timer = 1500;
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.player.itemtimer && !this.timer && !this.player.timer;
    }
}

class WeaponBleed extends Aura {
    constructor(player, id, duration, interval, dmg, offhand) {
        super(player, id, 'Weapon Bleed' + (offhand ? ' OH' : ' MH'));
        this.duration = parseInt(duration) / 1000;
        this.interval = parseInt(interval);
        this.ticks = duration / interval;
        this.dmg = parseInt(dmg) * (this.player.bleedmod || 1);
        this.idmg = 0;
        this.totaldmg = 0;
    }
    step() {
        while (step >= this.nexttick) {
            this.idmg += this.dmg;
            this.totaldmg += this.dmg;

            if (this.player.bleedrage) {
                let oldRage = this.player.rage;
                this.player.rage += this.player.bleedrage;
                if (this.player.rage > 100) this.player.rage = 100;
                if (this.player.auras.consumedrage && oldRage < 80 && this.player.rage >= 80)
                    this.player.auras.consumedrage.use();
            }

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${this.dmg}`); /* end-log */

            this.nexttick += this.interval;
        }

        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
        }
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.nexttick = step + this.interval;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
    }
}

class Ragehammer extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 15;
        this.stats = { ap: 20 }
        this.mult_stats = { haste: 5 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAP();
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Jackhammer extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.mult_stats = { haste: 30 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class LordGeneral extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.stats = { ap: 50 };
    }
}

class Stoneslayer extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 8;
        this.stats = { bonusdmg: 10 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateBonusDmg();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateBonusDmg();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class CleaveArmor extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.armor = 300;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateArmorReduction();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateArmorReduction();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class StrengthChampion extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.stats = { str: 120 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateStrength();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateStrength();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}