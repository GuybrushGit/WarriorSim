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
        this.defenseType = DEFENSETYPE.MELEE;
        this.school = SCHOOL.PHYSICAL;
        this.minrage = 0;
        this.offensive = true;

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
        if (spell.consumedrage) this.consumedrage = spell.consumedrage;
        if (spell.unqueueactive) this.unqueue = parseInt(spell.unqueue);
        if (spell.exmacro) this.exmacro = spell.exmacro;
        if (spell.execute) this.execute = spell.execute;
        if (spell.globalsactive) this.globals = spell.globals;
        if (spell.bloodsurge) this.bloodsurge = spell.bloodsurge;
        if (spell.afterswing) this.afterswing = spell.afterswing;
        if (spell.swingreset) this.swingreset = spell.swingreset;
        if (spell.timetoendactive) this.timetoend = parseInt(spell.timetoend) * 1000;
        if (spell.timetostartactive) this.timetostart = parseInt(spell.timetostart) * 1000;
        if (spell.zerkerpriority) this.zerkerpriority = spell.zerkerpriority;
        if (spell.swordboard) this.swordboard = spell.swordboard;
        if (spell.resolve) this.resolve = spell.resolve;
        if (spell.switchstart) this.switchstart = spell.switchstart;
        if (spell.switchtimeactive) this.switchtime = parseInt(spell.switchtime) * 1000;
        if (spell.switchtimeactive) this.switchrage = spell.switchrage;
        if (spell.switchtimeactive) this.switchtimeactive = spell.switchtimeactive;
        if (spell.switchdefault) this.switchdefault = spell.switchdefault;
        if (spell.durationactive) this.duration = parseInt(spell.duration);
        
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
        this.cost = 30 - player.ragecostbonus;
        this.cooldown = 6;
        this.weaponspell = false;
    }
    dmg() {
        let dmg;
        dmg = this.player.stats.ap * 0.45;
        return dmg * this.player.stats.dmgmod * this.player.mainspelldmg;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
}

class Whirlwind extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 25 - player.ragecostbonus;
        this.cooldown = 10;
        this.refund = false;
    }
    dmg() {
        if (this.player.auras.consumedrage && this.player.auras.consumedrage.timer) this.offhandhit = true;
        let dmg;
        dmg = rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        dmg += (this.player.stats.ap / 14) * this.player.mh.normSpeed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    use() {
        if (!this.player.isValidStance('zerk')) this.player.switch('zerk');
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && 
        (this.player.isValidStance('zerk') || this.player.talents.rageretained >= this.cost) &&
        (!this.maxrage || this.player.isValidStance('zerk') || this.player.rage <= this.maxrage) &&
        (!this.minrage || this.player.rage >= this.minrage) &&
        (!this.maincd || 
            (this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class Overpower extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 5 - player.ragecostbonus;
        this.cooldown = 5;
        this.canDodge = false;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        dmg += (this.player.stats.ap / 14) * this.player.mh.normSpeed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    use() {
        this.player.timer = 1500;
        this.player.dodgetimer = 0;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (!this.player.isValidStance('battle')) this.player.switch('battle');
        this.player.rage -= this.cost;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.dodgetimer &&
        (this.player.isValidStance('battle') || this.player.talents.rageretained >= this.cost) &&
        (!this.maxrage || this.player.isValidStance('battle') || this.player.rage <= this.maxrage) &&
        (!this.maincd || 
            (this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class Execute extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 15 - player.talents.executecost - player.ragecostbonus;
        this.usedrage = 0;
        this.totalusedrage = 0;
        this.refund = false;
        this.weaponspell = false;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + (this.value2 * this.usedrage);
        return dmg * this.player.stats.dmgmod;
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
        this.totalusedrage += this.usedrage - (this.player.auras.suddendeath && this.player.auras.suddendeath.timer ? 10 : 0);
        this.timer = 1 - (step % 1);
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    step(a) {
        if (this.timer <= a) {
            this.timer = 0;
            if (this.result != RESULT.MISS && this.result != RESULT.DODGE) {
                // moved to procattack
            }
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
        this.offensive = false;
    }
    use() {
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + this.rage, 100);
        this.player.auras.bloodrage.use();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 60 && this.player.rage >= 60)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0;
    }
}

class HeroicStrike extends Spell {
    constructor(player, id) {
        super(player, id, "Heroic Strike");
        this.cost = 15 - player.talents.impheroicstrike - player.ragecostbonus;
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
        this.cost = 20 - player.ragecostbonus;
        this.bonus = this.value1 * (1 + this.player.talents.cleavebonus / 100);
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
        this.cost = 30 - player.ragecostbonus;
        this.cooldown = 6;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        dmg += (this.player.stats.ap / 14) * this.player.mh.normSpeed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod * this.player.mainspelldmg;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && this.player.rage >= this.minrage;
    }
}

class SunderArmor extends Spell {
    constructor(player, id) {
        super(player, id, 'Sunder Armor');
        this.cost = 15 - player.talents.impsunderarmor - player.ragecostbonus;
        this.stacks = 0;
        this.nocrit = true;
    }
    use() {
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.stacks = Math.min(6, this.stacks + 1);
        if (this.player.homunculi || this.player.exposed) this.stacks = 6;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    dmg() {
        if (!this.devastate) return 0;
        let mod = 1.5 * (1 + 0.1 * (this.stacks - 1));
        let dmg = (this.player.mh.mindmg + this.player.mh.maxdmg) / 2;
        let dps = (dmg  + (this.player.stats.ap / 14) * this.player.mh.speed) / this.player.mh.speed;
        return dps * mod * this.player.stats.dmgmod;
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
        this.cost = 10 - player.ragecostbonus;
        if (player.items.includes(19577)) this.cost -= 2;
    }
    dmg() {
        let dmg;
        dmg = this.value1;
        return dmg * this.player.stats.dmgmod;
    }
}

class ThunderClap extends Spell {
    constructor(player, id) {
        super(player, id);
        this.defenseType = DEFENSETYPE.MAGIC
        this.cost = 20 - player.ragecostbonus - player.talents.impthunderclap;
    }
    dmg() {
        let dmg;
        dmg = this.value1 + (this.player.mode == "sod" ? ~~(this.player.stats.ap * 0.05) : 0);
        if(this.player.furiousthunder)
            dmg *= 2;
        return dmg * this.player.stats.dmgmod;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage &&
            (!this.minrage || this.player.rage >= this.minrage) &&
            (this.player.furiousthunder || this.player.isValidStance('battle'));
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
        let dmg;
        dmg = this.player.stats.ap * 0.45;
        return dmg * this.player.stats.dmgmod;
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
        dmg += (this.player.stats.ap / 14) * this.player.mh.normSpeed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    canUse(executephase) {
        return !this.timer && !this.player.timer && 
            (!executephase || this.execute) &&
            this.player.isEnraged();
    }
    reduce(spell) {
        // Raging blow cooldown is reduced by 1 second when you use another melee ability while enraged.
        if (this.timer && this.player.isEnraged() && spell && spell != this && spell.offensive) {
            this.timer = Math.max(0, this.timer - 1000);
        }
    }
}

class BerserkerRage extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 0;
        this.rage = player.talents.berserkerbonus;
        this.cooldown = 30;
        this.useonly = true;
        this.offensive = false;
    }
    use() {
        this.player.timer = 1500;
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        if (!this.player.isValidStance('zerk')) this.player.switch('zerk');
        this.player.rage = Math.min(this.player.rage + this.rage, 100);
        this.player.auras.berserkerrage.use();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 60 && this.player.rage >= 60)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0 && !this.player.timer &&
            (!this.maxrage || this.player.isValidStance('zerk') || this.player.rage <= this.maxrage);
    }
}

class QuickStrike extends Spell {
    constructor(player, id) {
        super(player, id, 'Quick Strike');
        this.cost = 20 - player.talents.impheroicstrike - player.ragecostbonus;
        this.cooldown = 0;
    }
    dmg() {
        let dmg;
        dmg = ~~rng(this.player.stats.ap * 0.10, this.player.stats.ap * 0.20) + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage && 
            ((!this.minrage && !this.maincd) ||
            (this.minrage && this.player.rage >= this.minrage) ||
            (this.maincd && this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.maincd && this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class RagePotion extends Spell {
    constructor(player, id) {
        super(player, id, 'Rage Potion');
        this.cost = 0;
        this.minrage = 80;
        this.cooldown = 120;
        this.useonly = true;
        this.offensive = false;
    }
    prep(duration) {
        if (typeof this.timetoend !== 'undefined') this.usestep = Math.max(duration - this.timetoend, 0);
        if (typeof this.timetostart !== 'undefined') this.usestep = this.timetostart;
        return 0;
    }
    use() {
        this.timer = this.cooldown * 1000;
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + ~~rng(this.value1, this.value2), 100);
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.auras.consumedrage && oldRage < 60 && this.player.rage >= 60)
            this.player.auras.consumedrage.use();
    }
    canUse() {
        return this.timer == 0 && this.player.rage < this.minrage && step >= this.usestep;
    }
}

class Slam extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 15 - player.ragecostbonus;
        this.casttime = player.precisetiming ? 0 : (1500 - (player.talents.impslam * 100));
        this.cooldown = player.precisetiming ? 6 : 0;
        this.mhthreshold = 0;
    }
    dmg(weapon) {
        if (!weapon) weapon = this.player.mh;
        let dmg;
        dmg = this.value1 + rng(weapon.mindmg + weapon.bonusdmg, weapon.maxdmg + weapon.bonusdmg);
        dmg += (this.player.stats.ap / 14) * weapon.speed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    use() {
        if (this.player.freeslam) this.offhandhit = true;
        if (!this.player.freeslam) this.player.rage -= this.cost;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.casttime && !this.player.freeslam) {
            this.player.mh.use();
            if (this.player.oh) this.player.oh.use();
        }
        this.player.freeslam = false;
        this.timer = this.cooldown * 1000;
        /* start-log */ if (log) this.player.log(`${this.name} done casting`); /* end-log */
    }
    canUse() {
        return !this.timer && !this.player.timer && this.player.mh.timer >= this.mhthreshold && (this.player.freeslam || this.cost <= this.player.rage) && 
            (!this.bloodsurge || this.player.freeslam) &&
            (!this.minrage || this.player.rage >= this.minrage) &&
            (!this.maincd || 
                (this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
                (this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class Fireball extends Spell {
    constructor(player, id) {
        super(player, id);
        this.useonly = true;
        this.proc = { magicdmg: 331+40 };
        this.idmg = 0;
        this.offensive = false;
    }
    prep(duration) {
        if (typeof this.timetoend !== 'undefined') this.usestep = Math.max(duration - this.timetoend, 0);
        if (typeof this.timetostart !== 'undefined') this.usestep = this.timetostart;
        return 0;
    }
    use() {
        this.timer = 1;
        let procdmg = this.player.magicproc(this.proc);
        this.idmg += procdmg;
        /* start-log */ if (log) this.player.log(`Fireball hit for ${procdmg}`); /* end-log */
    }
    canUse() {
        return !this.timer && step >= this.usestep;
    }
}

class GunAxe extends Spell {
    constructor(player, id) {
        super(player, id);
        this.useonly = true;
        this.proc = { magicdmg: 150 + 75 };
        this.idmg = 0;
        this.offensive = false;
    }
    prep(duration) {
        if (typeof this.timetoend !== 'undefined') this.usestep = Math.max(duration - this.timetoend, 0);
        if (typeof this.timetostart !== 'undefined') this.usestep = this.timetostart;
        return 0;
    }
    use() {
        this.timer = 1;
        let procdmg = this.player.magicproc(this.proc);
        this.idmg += procdmg;
        /* start-log */ if (log) this.player.log(`Gun Axe hit for ${procdmg}`); /* end-log */
    }
    canUse() {
        return !this.timer && step >= this.usestep;
    }
}

class BlademasterFury extends Spell {
    constructor(player, id) {
        super(player, id, 'Blademaster\'s Fury');
        this.cooldown = 120;
    }
    dmg() {
        let dmg;
        dmg = rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg);
        dmg += (this.player.stats.ap / 14) * this.player.mh.normSpeed + this.player.stats.moddmgdone;
        return dmg * this.player.stats.dmgmod;
    }
    use() {
        this.player.timer = 1500;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        if (this.player.spells.whirlwind) {
            this.player.spells.whirlwind.timer = 0;
            /* start-log */ if (log) this.player.log(`${this.player.spells.whirlwind.name} off cooldown`); /* end-log */
        }
    }
    canUse() {
        return !this.timer && !this.player.timer && 
            (!this.player.spells.whirlwind || this.player.spells.whirlwind.timer > 0);
    }
}

class ShieldSlam extends Spell {
    constructor(player, id) {
        super(player, id, 'Shield Slam');
        this.cost = 20 - player.ragecostbonus;
        this.cooldown = 6;
        if (this.duration) this.cooldown = Math.max(this.cooldown, this.duration);
        if (this.swordboard) this.cost = 0;
    }
    dmg() {
        let dmg;
        // SS benefits from the buff it triggers, add it manually if its not up
        let ap = this.player.stats.ap + (this.player.auras.defendersresolve && !this.player.auras.defendersresolve.timer ? 4 * this.player.stats.defense : 0);
        dmg = rng(this.value1, this.value2) + (this.player.stats.block * 2) + ~~(ap * 0.15);
        return dmg * this.player.stats.dmgmod * this.player.mainspelldmg;
    }
    use() {
        this.player.timer = 1500;
        if (!this.player.freeshieldslam) this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.player.freeshieldslam = false;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    canUse() {
        return this.player.shield && !this.timer && !this.player.timer && (this.player.freeshieldslam || this.cost <= this.player.rage) 
            && (this.player.freeshieldslam || this.player.rage >= this.minrage)
            && (!this.resolve || (this.player.auras.defendersresolve && !this.player.auras.defendersresolve.timer))
            && (!this.swordboard || this.player.freeshieldslam);
    }
}

class Shockwave extends Spell {
    constructor(player, id) {
        super(player, id);
        this.cost = 15 - player.ragecostbonus;
        this.cooldown = 20;
        this.canDodge = false;
    }
    dmg() {
        let dmg = this.player.stats.ap / 2;
        return dmg * this.player.stats.dmgmod;
    }
    use() {
        if (!this.player.isValidStance('def')) this.player.switch('def');
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
    }
    canUse() {
        return this.player.shield && !this.timer && !this.player.timer && this.cost <= this.player.rage && 
        (this.player.isValidStance('def') || this.player.talents.rageretained >= this.cost) &&
        (!this.maxrage || this.player.isValidStance('def') || this.player.rage <= this.maxrage) &&
        (!this.minrage || this.player.rage >= this.minrage) &&
        (!this.maincd || 
            (this.player.spells.bloodthirst && this.player.spells.bloodthirst.timer >= this.maincd) || 
            (this.player.spells.mortalstrike && this.player.spells.mortalstrike.timer >= this.maincd));
    }
}

class TheMoltenCore extends Spell {
    constructor(player, id) {
        super(player, id, 'The Molten Core');
        this.useonly = true;
        this.proc = { magicdmg: 20 };
        this.idmg = 0;
        this.offensive = false;
    }
    use() {
        let procdmg = this.player.magicproc(this.proc);
        for (let i = 0; i < this.player.adjacent; i++) {
            procdmg += this.player.magicproc(this.proc);
        }
        this.idmg += procdmg;
        /* start-log */ if (log) this.player.log(`The Molten Core hit for ${procdmg}`); /* end-log */
    }
}

class UnstoppableMight extends Spell {
    constructor(player, id) {
        super(player, id, 'Unstoppable Might');
        this.useonly = true;
        this.offensive = false;
    }
    use() {
        if (this.player.stance != 'battle') this.player.switch('battle');
        else this.player.switch(this.player.basestance == 'battle' ? 'zerk' : this.player.basestance);
    }
    canUse() {
        //Switch if Forecast shorter than X secs and rage below Y
        let forecast = Math.max(this.player.auras.battleforecast.timer - step, this.player.auras.berserkerforecast.timer - step);
        return (this.switchtimeactive && this.player.rage <= this.switchrage && forecast <= this.switchtime);
    }
}

class StanceSwitch extends Spell {
    constructor(player, id) {
        super(player, id, 'Stance Switch');
        this.useonly = true;
        this.offensive = false;
    }
    use() {
        this.player.switch(this.player.basestance);
    }
    canUse() {
        return !this.player.timer && !this.player.stancetimer && this.player.stance != this.player.basestance && 
            (!this.player.spells.unstoppablemight || this.player.spells.unstoppablemight.switchdefault);
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
        this.offensive = false;

        let spell = spells.filter(s => s.id == this.id)[0];
        if (!spell) spell = buffs.filter(s => s.id == this.id)[0];
        if (!spell) return;
        if (spell.durationactive) this.duration = parseInt(spell.duration);
        if (spell.timetoendactive) this.timetoend = parseInt(spell.timetoend) * 1000;
        if (spell.timetostartactive) this.timetostart = parseInt(spell.timetostart) * 1000;
        if (spell.crusaders) this.crusaders = parseInt(spell.crusaders);
        if (spell.haste) this.mult_stats = { haste: parseInt(spell.haste) };
        if (spell.value1) this.value1 = spell.value1;
        if (spell.value2) this.value2 = spell.value2;
        if (spell.minlevel) this.minlevel = spell.minlevel;
        if (spell.procblock) this.procblock = spell.procblock;
        if (spell.rageblockactive) this.rageblock = parseInt(spell.rageblock);
        if (spell.erageblockactive) this.erageblock = parseInt(spell.erageblock);
        if (spell.chargeblockactive) this.chargeblock = parseInt(spell.chargeblock);
        if (spell.echargeblockactive) this.echargeblock = parseInt(spell.echargeblock);
        if (spell.wfap) this.wfap = parseInt(spell.wfap);
        if (spell.wfapperc) this.wfapperc = parseInt(spell.wfapperc);
        if (spell.alwaystails) this.alwaystails = spell.alwaystails;
        if (spell.alwaysheads) this.alwaysheads = spell.alwaysheads;
        if (spell.item) this.item = spell.item;
        if (spell.noitemcd) this.noitemcd = spell.noitemcd;
        if (spell.maxrageactive) this.maxrage = parseInt(spell.maxrage);

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
    prep(duration, itemdelay) {
        if (typeof this.timetostart !== 'undefined') {
            this.usestep = this.timetostart;
        }
        if (typeof this.timetoend !== 'undefined') {
            if (this.item && !this.noitemcd) {
                this.usestep = Math.max(Math.min(duration - this.timetoend, duration - itemdelay - (this.duration * 1000)), 0);
                return this.duration * 1000;
            }
            else {
                this.usestep = Math.max(duration - this.timetoend, 0);
            }
        }
        return 0;
    }
    remove() {
        if (this.timer) {
            this.uptime += (step - this.starttimer);
            this.timer = 0;
            this.player.updateAuras();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class Recklessness extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 12;
        this.stats = { crit: this.player.mode == "sod" ? 50 : 100 };
        this.cooldown = this.player.mode == "sod" ? 300 : 1800;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.player.timer = 1500;
        this.starttimer = step;
        if (!this.player.isValidStance('zerk')) this.player.switch('zerk');
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return !this.timer && !this.player.timer && step >= this.usestep;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.usestep = this.starttimer + (this.cooldown * 1000);
            this.player.updateAuras();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
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
    tickdmg(offhand) {
        let min;
        let max;
        if (!offhand) {
            min = this.player.mh.mindmg + this.player.mh.bonusdmg + this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.mh.speed;
            max = this.player.mh.maxdmg + this.player.mh.bonusdmg + this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.mh.speed;
        }
        else {
            min = this.player.oh.mindmg + this.player.oh.bonusdmg + this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.oh.speed;
            max = this.player.oh.maxdmg + this.player.oh.bonusdmg + this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.oh.speed;
        }
        let dmg = (min + max) / 2;
        dmg *= (!offhand ? this.player.mh.modifier : this.player.oh.modifier) * this.player.stats.dmgmod * this.player.talents.deepwounds * this.player.bleedmod; 
        return dmg;
    }
    step() {
        while (step >= this.nexttick) {
            this.player.stepauras(true);
            let dmg = this.saveddmg / this.ticksleft;
            this.saveddmg -= dmg;
            //dmg *= this.player.mh.modifier * this.player.stats.dmgmod;
            this.idmg += dmg;
            this.totaldmg += dmg;
            this.ticksleft--;

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${dmg.toFixed(2)}`); /* end-log */

            this.nexttick += 3000;
        }

        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.nexttick = 0;
            this.firstuse = false;
            this.saveddmg = 0;
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    use(offhand) {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.ticksleft = 4;
        this.saveddmg += this.tickdmg(offhand);
        if (!this.nexttick) {
            this.nexttick = step + 3000;
            this.timer = step + this.duration * 1000;
        }
        else {
            this.timer = this.nexttick - 3000 + this.duration * 1000;
        }
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
            let min = this.player.mh.mindmg + this.player.mh.bonusdmg+ this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.mh.speed;
            let max = this.player.mh.maxdmg + this.player.mh.bonusdmg+ this.player.stats.moddmgdone + (this.player.stats.ap / 14) * this.player.mh.speed;
            let dmg = (min + max) / 2;
            dmg *= this.player.mh.modifier * this.player.stats.dmgmod * this.player.talents.deepwounds * this.player.bleedmod;
            this.idmg += dmg / 4;
            this.totaldmg += dmg / 4;

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
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAuras();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.player.itemtimer && !this.timer && step >= this.usestep;
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
        this.cooldown = 180;
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
        return !this.timer && !this.player.timer && this.player.rage >= 10 && step >= this.usestep;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.usestep = this.starttimer + (this.cooldown * 1000);
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class BattleStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Battle Stance');
        this.stats = { };
    }
}

class DefensiveStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Defensive Stance');
        this.mult_stats = { dmgmod: -10, spelldmgmod: -10, };
    }
}

class BerserkerStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Berserker Stance');
        this.stats = { crit: 3 };
    }
}

class GladiatorStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Gladiator Stance');
        this.mult_stats = { dmgmod: 10 };
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
        if (this.player.auras.consumedrage && oldRage < 60 && this.player.rage >= 60)
            this.player.auras.consumedrage.use();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
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
        this.stats = { moddmgdone: 10 };
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
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateBonusDmg();
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
        if (this.player.faeriefire) return;
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
        if (this.player.faeriefire) return;
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
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
        this.chance = ~~(player.mh.speed * 10 / 0.006); // 10 PPM
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
        return this.firstuse && !this.timer && !this.player.timer && !this.player.itemtimer && step >= this.usestep;
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
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
    }
}

class Earthstrike extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.stats = { ap: 280 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
        super(player, id, 'Primal Blessing');
        this.duration = 12;
        this.stats = { ap: 300 };
        this.cooldown = 240;
        this.cooldowntimer = 0;
    }
    use() {
        if (this.cooldowntimer > step) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.cooldowntimer = step + this.cooldown * 1000;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
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
            if (this.player.auras.consumedrage && this.player.rage >= 60 && this.player.rage < 81)
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
        this.stats = { moddmgdone: 40 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stats.moddmgdone = 40;
        this.player.updateBonusDmg();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    proc() {
        this.stats.moddmgdone -= 2;
        this.player.updateBonusDmg();
        if (this.stats.moddmgdone <= 0) {
            this.timer = step;
            this.step();
        }
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateBonusDmg();
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

class BattleShout extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 120 + (this.player.talents.boomingvoice * 36);
        this.cost = 10 - (this.player.talents.boomingvoice * 2);
        this.name = 'Battle Shout';
        let lvlbonus = ~~((this.player.level - this.minlevel) * this.value2);
        this.stats.ap = ~~((this.value1 + lvlbonus + (this.player.enhancedbs ? 30 : 0)) * (1 + this.player.talents.impbattleshout))
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.rage -= this.cost;
        this.player.timer = 1500;
        this.player.updateAP();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    canUse() {
        return !this.timer && !this.player.timer && this.cost <= this.player.rage;
    }
}

class ConsumedRage extends Aura {
    constructor(player, id) {
        super(player, id, 'Consumed by Rage');
        this.duration = 12;
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
        this.cost = 10 - player.ragecostbonus;
        this.idmg = 0;
        this.totaldmg = 0;
        this.data = [0, 0, 0, 0, 0];
        this.canDodge = true;
        this.nocrit = true;
        this.dmgmod = 1 + this.player.talents.rendmod / 100;
        this.tfbstep = -6000;
        this.offensive = true;
    }
    step() {
        while (step >= this.nexttick && this.stacks) {
            this.idmg += this.tickdmg;
            this.totaldmg += this.tickdmg;

            /* start-log */ if (log) this.player.log(`${this.name} tick for ${this.tickdmg.toFixed(2)}`); /* end-log */

            this.nexttick += 3000;
            this.stacks--;

            if (!this.stacks) {
                this.uptime += (step - this.starttimer);
                /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
            }

            // Taste for Blood
            if (this.player.tasteforblood && (this.tfbstep + 6000) <= step) {
                this.player.dodgetimer = 9000;
                this.tfbstep = step;
                /* start-log */ if (log) this.player.log(`Taste of Blood applied`); /* end-log */
            }
        }

        if (step >= this.timer) {
            this.timer = 0;
            this.firstuse = false;
        }
    }
    use() {
        let result = this.player.rollmeleespell(this);
        this.data[result]++;
        if (result == RESULT.MISS) return;
        if (result == RESULT.DODGE) {
            this.player.dodgetimer = 5000;
            return;
        }

        if (this.timer) this.uptime += (step - this.starttimer);
        this.nexttick = step + 3000;
        this.timer = step + this.duration * 1000;
        this.player.timer = 1500;
        this.starttimer = step;
        this.stacks = this.value2;
        if (!this.player.isValidStance('battle', true))
            this.player.switch('battle');
        this.player.rage -= this.cost;

        let basedmg = this.value1;
        if (this.player.bloodfrenzy)
            basedmg += this.value1 + ~~(this.player.stats.ap * 0.03 * this.value2);
       let dmg = basedmg * this.player.stats.dmgmod * this.dmgmod * this.player.bleedmod;
       this.tickdmg = dmg / this.value2;

        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return !this.timer && !this.player.timer && this.player.rage >= this.cost &&
            (this.player.isValidStance('battle', true) || this.player.talents.rageretained >= this.cost) && 
            (!this.maxrage || this.player.isValidStance('battle', true) || this.player.rage <= this.maxrage);
    }
    end() {
        if (this.stacks)
            this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.tfbstep = -6000;
    }
}

class Vibroblade extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.armor = 100;
    }
    use() {
        if (this.player.faeriefire) return;
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

class Ultrasonic extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.armor = 160;
    }
    use() {
        if (this.player.faeriefire) return;
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
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
}

class WeaponBleed extends Aura {
    constructor(player, id, duration, interval, dmg, offhand) {
        super(player, id, 'Weapon Bleed' + (offhand ? ' OH' : ' MH'));
        this.duration = parseInt(duration) / 1000;
        this.interval = parseInt(interval);
        this.ticks = duration / interval;
        this.dmg = parseInt(dmg) * this.player.bleedmod;
        this.idmg = 0;
        this.totaldmg = 0;
    }
    step() {
        while (step >= this.nexttick) {
            this.idmg += this.dmg;
            this.totaldmg += this.dmg;

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

class BlisteringRagehammer extends Aura {
    constructor(player, id) {
        super(player, id, 'Blistering Ragehammer');
        this.duration = 15;
        this.stats = { moddmgdone: 30 };
        this.mult_stats = { haste: 10 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateBonusDmg();
        this.player.updateHaste();
        this.player.updateHasteDamage();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateBonusDmg();
            this.player.updateHaste();
            this.player.updateHasteDamage();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateBonusDmg();
        this.player.updateHasteDamage();
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
        this.stats = { moddmgdone: 10 };
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
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateBonusDmg();
    }
}

class CleaveArmor extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 20;
        this.armor = 300;
    }
    use() {
        if (this.player.faeriefire) return;
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

class MildlyIrradiated extends Aura {
    constructor(player, id) {
        super(player, id, 'Mildly Irradiated');
        this.duration = 15;
        this.stats = { ap: 40 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class GyromaticAcceleration extends Aura {
    constructor(player, id) {
        super(player, id, 'Gyromatic Acceleration');
        this.duration = 20;
        this.mult_stats = { haste: 5 };
    }
    use() {
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
}

class Spicy extends Aura {
    constructor(player, id) {
        super(player, id, 'Spicy!');
        this.duration = 30;
        this.mult_stats = { haste: 4 };
    }
    use() {
        if (!this.firstuse) return;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.firstuse = false;
        this.player.updateHaste();
        this.player.updateHasteDamage();
        if (!this.player.attackproc1) this.player.attackproc1 = { chance: 500, magicdmg: 7, spicy: true };
        if (!this.player.attackproc2) this.player.attackproc2 = { chance: 500, magicdmg: 7, spicy: true };
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateHaste();
            this.player.updateHasteDamage();
            if (this.player.attackproc1 && this.player.attackproc1.spicy) delete this.player.attackproc1;
            if (this.player.attackproc2 && this.player.attackproc2.spicy) delete this.player.attackproc2;
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateHasteDamage();
        if (this.player.attackproc1 && this.player.attackproc1.spicy) delete this.player.attackproc1;
        if (this.player.attackproc2 && this.player.attackproc2.spicy) delete this.player.attackproc2;
    }
}

class GneuroLogical extends Aura {
    constructor(player, id) {
        super(player, id, 'Gneuro-Logical Shock');
        this.duration = 10;
        this.mult_stats = { haste: 20 };
    }
    use() {
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
}

class CoinFlip extends Aura {
    constructor(player, id) {
        super(player, id, 'Coin Flip');
        this.duration = 30;
        this.stats = { crit: 3 };
    }
    use() {
        this.firstuse = false;
        if (this.alwaystails) return;
        if (this.alwaysheads || rng10k() < 5000) {
            this.timer = step + this.duration * 1000;
            this.starttimer = step;
            this.player.updateAuras();
            /* start-log */ if (log) this.player.log(`${this.name} Crit applied`); /* end-log */
        }
    }
    canUse() {
        return this.firstuse && !this.timer && step >= this.usestep;
    }
}

class Rampage extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 30;
        this.mult_stats = { apmod: 10 };
        this.cooldown = 120;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.player.timer = 1500;
        this.starttimer = step;
        this.player.updateAP();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return !this.timer && !this.player.timer && this.player.isEnraged() && step >= this.usestep;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.usestep = this.starttimer + (this.cooldown * 1000);
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class WreckingCrew extends Aura {
    constructor(player, id) {
        super(player, id, 'Wrecking Crew');
        this.duration = 12;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.mainspelldmg = 1.1;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.mainspelldmg = 1;
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class SerpentAscension extends Aura {
    constructor(player, id) {
        super(player, id, 'Serpent\'s Ascension');
        this.duration = 12;
        this.stats = { ap: 150 };
        this.cooldown = 120;
        this.cooldowntimer = 0;
    }
    use() {
        if (this.cooldowntimer > step) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.cooldowntimer = step + this.cooldown * 1000;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class VoodooFrenzy extends Aura {
    constructor(player, id) {
        super(player, id, 'Voodoo Frenzy');
        this.duration = 10;
        this.cooldown = 40;
        this.cooldowntimer = 0;
    }
    use() {
        if (this.cooldowntimer > step) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.cooldowntimer = step + this.cooldown * 1000;
        if (this.player.stats.str >= this.player.stats.agi) this.stats = { str: 35 };
        else this.stats = { agi: 35 };
        this.player.updateAuras();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class RoarGuardian extends Aura {
    constructor(player, id) {
        super(player, id, 'Roar of the Guardian');
        this.duration = 20;
        this.stats = { ap: 70 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
    }
}

class RelentlessStrength extends Aura {
    constructor(player, id) {
        super(player, id, 'Relentless Strength');
        this.duration = 20;
        this.stats = { moddmgdone: 20 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stats.moddmgdone = 20;
        this.player.updateBonusDmg();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    proc() {
        this.stats.moddmgdone -= 1;
        this.player.updateBonusDmg();
        if (this.stats.moddmgdone <= 0) {
            this.timer = step;
            this.step();
        }
    }
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
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
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateBonusDmg();
    }
}

class EchoesDread extends Aura {
    constructor(player, id) {
        super(player, id, 'Echoes of Dread');
        this.duration = 10;
        this.stats = { ap: 50 };
        this.mult_stats = { haste: 5 };
        this.cooldown = 40;
        this.cooldowntimer = 0;
    }
    use() {
        if (this.cooldowntimer > step) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.cooldowntimer = step + this.cooldown * 1000;
        this.player.updateAP();
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class FreshMeat extends Aura {
    constructor(player, id) {
        super(player, id, 'Fresh Meat');
        this.duration = 12;
        this.mult_stats = { dmgmod: 10 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateDmgMod();
        this.firstuse = false;
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

class SuddenDeath extends Aura {
    constructor(player, id) {
        super(player, id, 'Sudden Death');
        this.duration = 10;
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
    remove() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
    }
}

class WarriorsResolve extends Aura {
    constructor(player, id) {
        super(player, id, 'Warrior\'s Resolve');
    }
    use() {
        let oldRage = this.player.rage;
        this.player.rage = Math.min(this.player.rage + 10, 100);
        if (this.player.auras.consumedrage && oldRage < 60 && this.player.rage >= 60)
            this.player.auras.consumedrage.use();
        /* start-log */ if (log) this.player.log(`${this.name} proc`); /* end-log */
    }
}

class EchoesStance extends Aura {
    constructor(player, id) {
        super(player, id, 'Echoes of Stance');
        this.duration = 5;
    }
    use(prev) {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stance = prev;
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class BattleForecast extends Aura {
    constructor(player, id) {
        super(player, id, 'Battle Forecast');
        this.mult_stats = { dmgmod: 10 };
        this.duration = 10;
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateDmgMod();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
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
    remove() {
        if (this.timer) {
            this.uptime += (step - this.starttimer);
            this.timer = 0;
            this.player.updateDmgMod();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class BerserkerForecast extends Aura {
    constructor(player, id) {
        super(player, id, 'Berserker Forecast');
        this.stats = { crit: 10 };
        this.duration = 10;
    }
}

class DefendersResolve extends Aura {
    constructor(player, id) {
        super(player, id, 'Defender\'s Resolve');
        this.duration = 15;
    }
    use() {
        this.stats = { ap: 4 * this.player.stats.defense };
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateAP();
        this.maxdelay = rng(this.player.reactionmin, this.player.reactionmax);
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.player.updateAP();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class MeltArmor extends Aura {
    constructor(player, id) {
        super(player, id, 'Melt Armor');
        this.duration = 10;
        this.stats.moddmgtaken = 10;
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
            this.player.updateBonusDmg();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class SingleMinded extends Aura {
    constructor(player, id) {
        super(player, id);
        this.duration = 10;
        this.stacks = 0;
        this.mult_stats = { haste: 2 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.stacks = Math.min(5, this.stacks + 1);
        this.mult_stats = { haste: 2 * this.stacks };
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.stacks = 0;
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
}

class DemonTaintedBlood extends Aura {
    constructor(player, id) {
        super(player, id, 'Demon-Tainted Blood');
        this.duration = 20;
        this.stats = { str: 80 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateStrength();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
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
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
    }
}

class MoonstalkerFury extends Aura {
    constructor(player, id) {
        super(player, id, 'Moonstalker Fury');
        this.duration = 15;
        this.stats = { str: 60 };
    }
    use() {
        this.player.itemtimer = this.duration * 1000;
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateStrength();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
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
    canUse() {
        return this.firstuse && !this.timer && !this.player.itemtimer && step >= this.usestep;
    }
}

class MagmadarsReturn extends Aura {
    constructor(player, id) {
        super(player, id, 'Magmadar\'s Return');
        this.duration = 12;
        this.mult_stats = { haste: 10 };
        this.cooldown = 60;
        this.cooldowntimer = 0;
    }
    use() {
        if (this.cooldowntimer > step) return;
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.cooldowntimer = step + this.cooldown * 1000;
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
}

class JujuFlurry extends Aura {
    constructor(player, id) {
        super(player, id, 'Juju Flurry');
        this.duration = 20;
        this.cooldown = 60;
        this.mult_stats = { haste: 3 };
    }
    use() {
        if (this.timer) this.uptime += (step - this.starttimer);
        this.timer = step + this.duration * 1000;
        this.starttimer = step;
        this.player.updateHasteDamage();
        this.player.updateHaste();
        /* start-log */ if (log) this.player.log(`${this.name} applied`); /* end-log */
    }
    canUse() {
        return !this.timer && step >= this.usestep;
    }
    step() {
        if (step >= this.timer) {
            this.uptime += (this.timer - this.starttimer);
            this.timer = 0;
            this.firstuse = false;
            this.usestep = this.starttimer + (this.cooldown * 1000);
            this.player.updateHasteDamage();
            this.player.updateHaste();
            /* start-log */ if (log) this.player.log(`${this.name} removed`); /* end-log */
        }
    }
    end() {
        this.uptime += (step - this.starttimer);
        this.timer = 0;
        this.stacks = 0;
        this.player.updateHasteDamage();
    }
}