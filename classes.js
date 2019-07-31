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
        this.timer = this.speed * 1000;
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
        this.base = {
            ap: 0,
            agi: 0,
            str: 0,
            hit: 0,
            crit: 0,
            skill: this.level * 5,
        };
        this.auras = [];
        this.update();
    }
    reset() {
        this.rage = 0;
        this.timer = 0;
        this.dodgeTimer = 0;
        this.mh.timer = 0;
        this.oh.timer = 0;
        if(this.bloodthirst) this.bloodthirst.timer = 0;
        if(this.overpower) this.overpower.timer = 0;
        if(this.whirlwind) this.whirlwind.timer = 0;
        if(this.execute) this.execute.timer = 0;
    }
    update() {
        this.stats = $.extend({}, this.base);
        for(let aura of this.auras)
            for(let prop in aura)
                this.stats[prop] += aura[prop];
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
        let low = 1.3 - 0.05*(this.target.defense - this.stats.skill);
        let high = 1.2 - 0.03*(this.target.defense - this.stats.skill);
        return (Math.min(low, 0.91) + Math.min(high, 0.99)) / 2;
    }
    getGlanceChance() {
        return 10 + (this.target.defense - Math.min(this.level*5, this.stats.skill)) * 2;
    }
    getMissChance() {
        let diff = this.target.defense - this.stats.skill;
        let miss = 5 + (diff > 10 ? diff * 0.2 : diff * 0.1);
        miss -= (diff > 10 ? this.stats.hit - 1 : this.stats.hit);
        return miss;
    }
    getCritChance() {
        let crit = this.stats.crit + (this.level - this.target.level) * 1 + (this.level - this.target.level) * 0.6;
        return crit > 0 ? crit : 0;
    }
    getDodgeChance() {
        return 5 + (this.target.defense - this.stats.skill) * 0.1;
    }
    getArmorReduction() {
        let r = this.target.armor / (this.target.armor + 400 + 85 * this.level);
        return r > 0.75 ? 0.75 : r;
    }
    addAura(aura) {
        this.auras.push(aura);
        this.update();
    }
    addRage(dmg, result, spell) {
        if (result == RESULT.MISS)
            return;
        if (spell) {
            if (result == RESULT.DODGE)
                this.rage += spell.refund ? spell.cost * 0.8 : 0;
        }
        else {
            let mod = result == RESULT.DODGE ? 0.75 : 1;
            this.rage += (dmg / 230.6) * 7.5 * mod;
        }
        if (log) console.log('Rage: ' + this.rage);
    }
    step() {
        this.mh.step();
        this.oh.step();
        this.timer = this.timer < 10 ? 0 : this.timer - 10;
        this.dodgeTimer = this.dodgeTimer < 10 ? 0 : this.dodgeTimer - 10;
        if(this.bloodthirst) this.bloodthirst.step();
        if(this.overpower) this.overpower.step();
        if(this.whirlwind) this.whirlwind.step();
        if(this.execute) this.execute.step();
    }
    roll(isAttack, canDodge) {
        let tmp = 0;
        let roll = rng(1,10000);
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
        weapon.use();
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
            if (log) console.log('Attack crits for ' + dmg);
        }
        if (result == RESULT.HIT) {
            if (log) console.log('Attack hits for ' + dmg);
        }

        return this.dealDamage(dmg, result);
    }
    cast(spell) {
        spell.use();
        let dmg = spell.dmg();
        let result = this.roll(false, spell.canDodge);
        let roll = rng(1,10000);

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
                if (log) console.log(spell.constructor.name + ' crits for ' + dmg);
            }
            else {
                if (log) console.log(spell.constructor.name + ' hits for ' + dmg);
            }
        }

        return this.dealDamage(dmg, result, spell);
    }
    dealDamage(dmg, result, spell) {
        // TODO: Modifiers
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            dmg *= (1 - this.armorReduction);
            this.addRage(dmg, result, spell);
            return dmg;
        }
        else {
            this.addRage(dmg, result, spell);
            return dmg;
        }
    }
}

function rng(min,max) {
    return Math.floor(Math.random()*(max-min+1)+min);
}