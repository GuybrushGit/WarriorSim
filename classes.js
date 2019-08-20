var RESULT = {
    HIT: 0,
    MISS: 1,
    DODGE: 2,
    CRIT: 3,
    GLANCE: 4
}
var WEAPONTYPE = {
    MACE: 0,
    SWORD: 1,
    DAGGER: 2,
    AXE: 3,
    FIST: 4,
    BIGMACE: 5,
    BIGSWORD: 6,
    BIGAXE: 7,
}

class Weapon {
    constructor(player, speed, mindmg, maxdmg, type, offhand) {
        this.player = player;
        this.speed = speed;
        this.mindmg = mindmg;
        this.maxdmg = maxdmg;
        this.type = type;
        this.modifier = offhand ? 0.5 : 1; // todo
        this.timer = 0;
        this.normSpeed = 2.4;
        this.offhand = offhand;
        if (type == WEAPONTYPE.DAGGER) this.normSpeed = 1.7;
        if (type == WEAPONTYPE.BIGMACE || type == WEAPONTYPE.BIGSWORD || type == WEAPONTYPE.BIGAXE) this.normSpeed = 3.3;
    }
    dmg() {
        let dmg = rng(this.mindmg, this.maxdmg) + (this.player.stats.ap / 14) * this.speed;
        return dmg * this.modifier;
    }
    use() {
        if (this.player.auras.flurry && !this.player.auras.flurry.procattack()) {
            delete this.player.auras.flurry;
            this.player.updateAuras();
            if (log) console.log('Remove aura: flurry');
        }
        this.timer = this.speed * 1000 * this.player.stats.haste;
    }
    step() {
        this.timer = this.timer < 200 ? 0 : this.timer - 200;
    }
}

class Player {
    constructor() {
        this.rage = 0;
        this.level = 60;
        this.timer = 0;
        this.dodgeTimer = 0;
        this.target = {
            level: 63,
            armor: 0,
            defense: 63 * 5,
        };
        this.base = { 
            ap: 0, 
            agi: 0, 
            str: 0, 
            hit: 0, 
            crit: 0, 
            skill_0: this.level * 5, 
            skill_1: this.level * 5, 
            skill_2: this.level * 5, 
            skill_3: this.level * 5, 
            skill_4: this.level * 5, 
            haste: 1, 
            strmod: 1, 
            agimod: 1, 
            dmgmod: 1 
        };
        this.stats = {};
        this.auras = [];
        this.spells = {};
        this.talents = {};
        this.armorReduction = this.getArmorReduction();
    }
    reset() {
        this.rage = 0;
        this.timer = 0;
        this.dodgeTimer = 0;
        this.mh.timer = 0;
        this.oh.timer = 0;
        this.auras = [];
        if (this.spells.bloodthirst) this.spells.bloodthirst.timer = 0;
        if (this.spells.overpower) this.spells.overpower.timer = 0;
        if (this.spells.whirlwind) this.spells.whirlwind.timer = 0;
        if (this.spells.execute) this.spells.execute.timer = 0;
        if (this.spells.battleshout) this.spells.battleshout.timer = 0;
        this.update();
    }
    update() {
        this.updateAuras();
        this.mh.glanceReduction = this.getGlanceReduction(this.mh);
        this.oh.glanceReduction = this.getGlanceReduction(this.oh);
        this.mh.glanceChance = this.getGlanceChance(this.mh);
        this.oh.glanceChance = this.getGlanceChance(this.oh);
        this.armorReduction = this.getArmorReduction();
        this.mh.miss = this.getMissChance(this.mh);
        this.oh.miss = this.getMissChance(this.oh);
        this.mh.dodge = this.getDodgeChance(this.mh);
        this.oh.dodge = this.getDodgeChance(this.oh);
    }
    updateAuras() {
        for (let prop in this.base)
            this.stats[prop] = this.base[prop];
        for (let name in this.auras) {
            for (let prop in this.auras[name].stats)
                this.stats[prop] += this.auras[name].stats[prop];
            for (let prop in this.auras[name].div_stats)
                this.stats[prop] /= (1 + this.auras[name].div_stats[prop]/100);
            for (let prop in this.auras[name].mult_stats)
                this.stats[prop] *= (1 + this.auras[name].mult_stats[prop]/100);
        }
        this.stats.str = ~~(this.stats.str * this.stats.strmod);
        this.stats.agi = ~~(this.stats.agi * this.stats.agimod);
        this.stats.ap += this.stats.str * 2;
        this.stats.crit += this.stats.agi / 20;
        this.crit = this.getCritChance();
    }
    getGlanceReduction(weapon) {
        let low = 1.3 - 0.05 * (this.target.defense - this.stats['skill_' + weapon.type]);
        let high = 1.2 - 0.03 * (this.target.defense - this.stats['skill_' + weapon.type]);
        return (Math.min(low, 0.91) + Math.min(high, 0.99)) / 2;
    }
    getGlanceChance(weapon) {
        return 10 + (this.target.defense - Math.min(this.level * 5, this.stats['skill_' + weapon.type])) * 2;
    }
    getMissChance(weapon) {
        let diff = this.target.defense - this.stats['skill_' + weapon.type];
        let miss = 5 + (diff > 10 ? diff * 0.2 : diff * 0.1);
        miss -= (diff > 10 ? this.stats.hit - 1 : this.stats.hit);
        return miss;
    }
    getCritChance() {
        let crit = this.stats.crit + (this.talents.crit || 0) + (this.level - this.target.level) * 1 + (this.level - this.target.level) * 0.6 + 3;
        return crit > 0 ? crit : 0;
    }
    getDodgeChance(weapon) {
        return 5 + (this.target.defense - this.stats['skill_' + weapon.type]) * 0.1;
    }
    getArmorReduction() {
        let r = this.target.armor / (this.target.armor + 400 + 85 * this.level);
        return r > 0.75 ? 0.75 : r;
    }
    addRage(dmg, result, spell) {
        if (spell) {
            if (result == RESULT.MISS || result == RESULT.DODGE)
                this.rage += spell.refund ? spell.cost * 0.8 : 0;
        }
        else {
            let mod = result == RESULT.MISS ? 0 : result == RESULT.DODGE ? 0.75 : 1;
            this.rage += (dmg / 230.6) * 7.5 * mod;
        }
        if (log) console.log('Rage: ' + this.rage);
    }
    step() {
        this.mh.step();
        this.oh.step();
        this.timer = this.timer < 200 ? 0 : this.timer - 200;
        this.dodgeTimer = this.dodgeTimer < 200 ? 0 : this.dodgeTimer - 200;
        if (this.spells.bloodthirst) this.spells.bloodthirst.step();
        if (this.spells.overpower) this.spells.overpower.step();
        if (this.spells.whirlwind) this.spells.whirlwind.step();
        if (this.spells.execute) this.spells.execute.step();
        if (this.spells.battleshout) this.spells.battleshout.step();
        if (this.auras.battleshout && !this.auras.battleshout.step()) {
            delete this.auras.battleshout;
            this.updateAuras();
            if (log) console.log('Remove aura: battleshout');
        }
        if (this.auras.battlestance && !this.auras.battlestance.step()) {
            delete this.auras.battlestance;
            this.updateAuras();
            if (log) console.log('Remove aura: battlestance');
        }
    }
    roll(canDodge, weapon) {
        let tmp = 0;
        let roll = rng(1, 10000);
        tmp += Math.max( (weapon ? weapon.miss : this.mh.miss) + (weapon ? 19 : 0), 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        if (canDodge) {
            tmp += (weapon ? weapon.dodge : this.mh.dodge) * 100;
            if (roll < tmp) return RESULT.DODGE;
        }
        if (weapon) {
            tmp += weapon.glanceChance * 100;
            if (roll < tmp) return RESULT.GLANCE;
            tmp += this.crit * 100;
            if (roll < tmp) return RESULT.CRIT;
        }
        return RESULT.HIT;
    }
    attack(weapon) {
        let dmg = weapon.dmg();
        let result = this.roll(true, weapon);

        if (result == RESULT.MISS) {
            if (log) console.log('Attack misses');
        }
        if (result == RESULT.DODGE) {
            this.dodgeTimer = 5000;
            if (log) console.log('Attack dodges');
        }
        if (result == RESULT.GLANCE) {
            dmg *= weapon.glanceReduction;
            if (log) console.log('Attack glances for ' + dmg);
        }
        if (result == RESULT.CRIT) {
            dmg *= 2;
            this.procCrit();
            if (log) console.log('Attack crits for ' + dmg);
        }
        if (result == RESULT.HIT) {
            if (log) console.log('Attack hits for ' + dmg);
        }

        weapon.use();
        return this.dealDamage(dmg, result);
    }
    cast(spell) {
        spell.use();
        let dmg = spell.dmg();
        let result = this.roll(spell.canDodge);
        let roll = rng(1, 10000);

        if (result == RESULT.MISS) {
            if (log) console.log(spell.constructor.name + ' misses');
        }
        if (result == RESULT.DODGE) {
            this.dodgeTimer = 5000;
            if (log) console.log(spell.constructor.name + ' dodges');
        }
        if (result == RESULT.HIT) {
            if (roll < this.crit * 100) {
                dmg *= 2;
                this.procCrit();
                if (log) console.log(spell.constructor.name + ' crits for ' + dmg);
            }
            else {
                if (log) console.log(spell.constructor.name + ' hits for ' + dmg);
            }
        }

        return this.dealDamage(dmg, result, spell);
    }
    buff(spell) {
        spell.use();
        return 0;
    }
    dealDamage(dmg, result, spell) {
        dmg *= this.stats.dmgmod;
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            dmg *= (1 - this.armorReduction);
            this.addRage(dmg, result, spell);
            return dmg;
        }
        else {
            this.addRage(dmg, result, spell);
            return 0;
        }
    }
    procCrit() {
        if (this.talents.flurry) {
            this.auras.flurry = new Flurry(this.talents.flurry);
            this.stats.haste /= (1 + this.auras.flurry.div_stats.haste/100);
            if (log) console.log('Add aura: Flurry');
        }
    }
}

class Simulation {
    constructor(player, timesecs, iterations, executeperc, output, callback) {
        this.player = player;
        this.timesecs = timesecs;
        this.iterations = iterations;
        this.output = output;
        this.total = 0;
        this.executestep = timesecs * 10 * (100 - executeperc);
        this.callback = callback || function() {};
    }
    start() {
        this.run(1);
    }
    run(i) {
        let player = this.player;
        player.reset();
        for (let step = 0; step < this.timesecs * 1000; step += 200) {
            player.step();
            if (player.mh.timer == 0) this.total += player.attack(player.mh);
            if (player.oh.timer == 0) this.total += player.attack(player.oh);
            if (player.timer == 0) {
                if (player.spells.execute && step >= this.executestep && player.spells.execute.canUse()) {
                    this.total += player.cast(player.spells.execute);
                    continue;
                }
                if (player.spells.overpower && player.spells.overpower.canUse()) {
                    this.total += player.cast(player.spells.overpower);
                    continue;
                }
                if (player.spells.battleshout && player.spells.battleshout.canUse()) {
                    player.buff(player.spells.battleshout);
                    continue;
                }
                if (player.spells.bloodthirst && player.spells.bloodthirst.canUse()) {
                    this.total += player.cast(player.spells.bloodthirst);
                    continue;
                }
                if (player.spells.whirlwind && player.spells.whirlwind.canUse()) {
                    this.total += player.cast(player.spells.whirlwind);
                    continue;
                }
            }
        }

        if (i % Math.floor(this.iterations / 20) == 0 || i == this.iterations) {
            this.output.text((this.total / (this.timesecs * i)).toFixed(2));
            if (i < this.iterations) {
                let view = this;
                setTimeout(function () { view.run(i + 1); }, 0);
            }
            else {
                this.callback();
            }
        }
        else {
            this.run(i + 1);
        }
    }

}

function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}