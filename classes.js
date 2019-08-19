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
    BIGMACE: 4,
    BIGSWORD: 5,
    BIGAXE: 6
}

class Weapon {
    constructor(player, speed, mindmg, maxdmg, type, offhand) {
        this.player = player;
        this.speed = speed;
        this.mindmg = mindmg;
        this.maxdmg = maxdmg;
        this.type = type;
        this.modifier = offhand ? 0.5 : 1;
        this.timer = 0;
        this.normSpeed = 2.4;
        if (type == WEAPONTYPE.DAGGER) this.normSpeed = 1.7;
        if (type == WEAPONTYPE.BIGMACE || type == WEAPONTYPE.BIGSWORD || type == WEAPONTYPE.BIGAXE) this.normSpeed = 3.3;
    }
    dmg() {
        let dmg = rng(this.mindmg, this.maxdmg) + (this.player.stats.ap / 14) * this.speed;
        return dmg * this.modifier;
    }
    use() {
        for (let name in this.player.auras)
            if (!this.player.auras[name].procattack()) {
                delete this.player.auras[name];
                this.player.update();
                if (log) console.log('Remove aura: ' + name);
            }
        this.timer = this.speed * 1000 * this.player.stats.haste;
    }
    step() {
        this.timer = this.timer < 10 ? 0 : this.timer - 10;
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
        this.base = { ap: 0, agi: 0, str: 0, hit: 0, crit: 0, skill: this.level * 5, haste: 1, strmod: 1, agimod: 1, dmgmod: 1 };
        this.stats = {};
        this.auras = [];
        this.spells = {};
        this.talents = {};
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

        this.stats.str = Math.floor(this.stats.str * this.stats.strmod);
        this.stats.agi = Math.floor(this.stats.agi * this.stats.agimod);
        this.stats.ap += this.stats.str * 2;
        this.stats.crit += this.stats.agi / 20;
        this.glanceReduction = this.getGlanceReduction();
        this.glanceChance = this.getGlanceChance();
        this.armorReduction = this.getArmorReduction();
        this.miss = this.getMissChance();
        this.crit = this.getCritChance();
        this.dodge = this.getDodgeChance();
    }
    getGlanceReduction() {
        let low = 1.3 - 0.05 * (this.target.defense - this.stats.skill);
        let high = 1.2 - 0.03 * (this.target.defense - this.stats.skill);
        return (Math.min(low, 0.91) + Math.min(high, 0.99)) / 2;
    }
    getGlanceChance() {
        return 10 + (this.target.defense - Math.min(this.level * 5, this.stats.skill)) * 2;
    }
    getMissChance() {
        let diff = this.target.defense - this.stats.skill;
        let miss = 5 + (diff > 10 ? diff * 0.2 : diff * 0.1);
        miss -= (diff > 10 ? this.stats.hit - 1 : this.stats.hit);
        return miss;
    }
    getCritChance() {
        let crit = this.stats.crit + (this.talents.crit || 0) + (this.level - this.target.level) * 1 + (this.level - this.target.level) * 0.6;
        return crit > 0 ? crit : 0;
    }
    getDodgeChance() {
        return 5 + (this.target.defense - this.stats.skill) * 0.1;
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
        this.timer = this.timer < 10 ? 0 : this.timer - 10;
        this.dodgeTimer = this.dodgeTimer < 10 ? 0 : this.dodgeTimer - 10;
        if (this.spells.bloodthirst) this.spells.bloodthirst.step();
        if (this.spells.overpower) this.spells.overpower.step();
        if (this.spells.whirlwind) this.spells.whirlwind.step();
        if (this.spells.execute) this.spells.execute.step();
        if (this.spells.battleshout) this.spells.battleshout.step();
        for(let name in this.auras)
            if (!this.auras[name].step()) {
                delete this.auras[name];
                this.update();
                if (log) console.log('Remove aura: ' + name);
            }

    }
    roll(isAttack, canDodge) {
        let tmp = 0;
        let roll = rng(1, 10000);
        tmp += Math.max(this.miss + (isAttack ? 19 : 0), 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        if (canDodge) {
            tmp += this.dodge * 100;
            if (roll < tmp) return RESULT.DODGE;
        }
        if (isAttack) {
            tmp += this.glanceChance * 100;
            if (roll < tmp) return RESULT.GLANCE;
            tmp += this.crit * 100;
            if (roll < tmp) return RESULT.CRIT;
        }
        return RESULT.HIT;
    }
    attack(weapon) {
        let dmg = weapon.dmg();
        let result = this.roll(true, true);

        if (result == RESULT.MISS) {
            if (log) console.log('Attack misses');
        }
        if (result == RESULT.DODGE) {
            this.dodgeTimer = 5000;
            if (log) console.log('Attack dodges');
        }
        if (result == RESULT.GLANCE) {
            dmg *= this.glanceReduction;
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
        let result = this.roll(false, spell.canDodge);
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
            this.update();
            if (log) console.log('Add aura: Flurry');
        }
    }
}

class Simulation {
    constructor(player, timesecs, iterations, output, callback) {
        this.player = player;
        this.timesecs = timesecs;
        this.iterations = iterations;
        this.output = output;
        this.total = 0;
        this.callback = callback || function() {};
    }
    start() {
        this.run(1);
    }
    run(i) {
        let player = this.player;
        player.reset();
        for (let step = 0; step < this.timesecs * 1000; step += 10) {
            player.step();
            if (player.mh.timer == 0) this.total += player.attack(player.mh);
            if (player.oh.timer == 0) this.total += player.attack(player.oh);
            if (player.timer == 0) this.total += player.rotation(step);
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