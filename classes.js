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
        this.modifier = offhand ? 0.5 * (1 + player.talents.offmod) * (1 + player.talents.onemod) : 1 + player.talents.onemod;
        this.timer = 0;
        this.normSpeed = 2.4;
        this.offhand = offhand;
        this.critbonus = 0;
        if (type == WEAPONTYPE.AXE || type == WEAPONTYPE.BIGAXE) this.critbonus += player.talents.axecrit;
        if (type == WEAPONTYPE.DAGGER) this.normSpeed = 1.7;
        if (type == WEAPONTYPE.BIGMACE || type == WEAPONTYPE.BIGSWORD || type == WEAPONTYPE.BIGAXE) this.normSpeed = 3.3;
        if (offhand) this.use();
    }
    dmg(heroicstrike) {
        let dmg = rng(this.mindmg, this.maxdmg) + (this.player.stats.ap / 14) * this.speed;
        if (heroicstrike) dmg += 138;
        return dmg * this.modifier;
    }
    use() {
        this.timer = this.speed * 1000 * this.player.stats.haste;

    }
    step(next) {
        this.timer = this.timer < 10 ? 0 : this.timer - next;
    }
}

class Player {
    constructor() {
        this.rage = 0;
        this.level = 60;
        this.timer = 0;
        this.dodgeTimer = 0;
        this.extraattacks = 0;
        this.nextswinghs = false;
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
            dmgmod: 1,
            dmg: 0
        };
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
        this.oh.use();
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
        return Math.max(crit, 0);
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
        if (!spell || spell instanceof HeroicStrike) {
            if (result != RESULT.MISS && result != RESULT.DODGE && this.talents.umbridledwrath && rng(1, 10000) < this.talents.umbridledwrath * 100)
                this.rage += 1;
        }  
    }
    step(simulation, batch, next) {
        this.mh.step(next);
        this.oh.step(next);
        if (!batch) return;
        this.timer = this.timer < 200 ? 0 : this.timer - 200;
        this.dodgeTimer = this.dodgeTimer < 200 ? 0 : this.dodgeTimer - 200;

        if (this.spells.bloodthirst) this.spells.bloodthirst.step();
        if (this.spells.overpower) this.spells.overpower.step();
        if (this.spells.whirlwind) this.spells.whirlwind.step();
        if (this.spells.execute) this.spells.execute.step();
        if (this.spells.battleshout) this.spells.battleshout.step();
        if (this.spells.berserkerrage) this.spells.berserkerrage.step();
        if (this.spells.bloodrage) this.spells.bloodrage.step();
        if (this.spells.deathwish) this.spells.deathwish.step();
        if (this.spells.jujuflurry) this.spells.jujuflurry.step();
        if (this.spells.ragepotion) this.spells.ragepotion.step();

        if (this.auras.battleshout && !this.auras.battleshout.step()) {
            delete this.auras.battleshout;
            this.updateAuras();
        }
        if (this.auras.battlestance && !this.auras.battlestance.step()) {
            delete this.auras.battlestance;
            this.updateAuras();
        }
        if (this.auras.deepwounds && !this.auras.deepwounds.step(simulation)) {
            delete this.auras.deepwounds;
        }
        if (this.auras.bloodrage && !this.auras.bloodrage.step(simulation)) {
            delete this.auras.bloodrage;
        }
        if (this.auras.deathwish && !this.auras.deathwish.step()) {
            delete this.auras.deathwish;
            this.updateAuras();
        }
        if (this.auras.jujuflurry && !this.auras.jujuflurry.step()) {
            delete this.auras.jujuflurry;
            this.updateAuras();
        }
        if (this.auras.ragepotion && !this.auras.ragepotion.step()) {
            delete this.auras.ragepotion;
            this.updateAuras();
        }
    }
    rollweapon(weapon) {
        let tmp = 0;
        let roll = rng(1, 10000);
        tmp += Math.max(weapon.miss + 19, 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        tmp += weapon.dodge * 100;
        if (roll < tmp) return RESULT.DODGE;
        tmp += weapon.glanceChance * 100;
        if (roll < tmp) return RESULT.GLANCE;
        tmp += (this.crit + weapon.critbonus) * 100;
        if (roll < tmp) return RESULT.CRIT;
        return RESULT.HIT;
    }
    rollspell(spell) {
        let tmp = 0;
        let roll = rng(1, 10000);
        tmp += Math.max(this.mh.miss, 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        if (spell.canDodge) {
            tmp += this.mh.dodge * 100;
            if (roll < tmp) return RESULT.DODGE;
        }
        roll = rng(1, 10000);
        let crit = this.crit + this.mh.critbonus;
        if (spell instanceof Overpower) 
            crit += this.talents.overpowercrit;
        if (roll < (crit * 100)) return RESULT.CRIT;
        return RESULT.HIT;
    }
    attack(weapon, extra) {
        let spell = null;
        let heroicstrike = !weapon.offhand && this.nextswinghs;
        let dmg = weapon.dmg(heroicstrike);
        let result = this.rollweapon(weapon);
        if (heroicstrike) {
            this.nextswinghs = false;
            spell = this.spells.heroicstrike;
            result = this.rollspell(spell);
        }
        if (!extra) {
            weapon.use();
            this.procattack(spell, weapon, result);
        }

        if (result == RESULT.DODGE) {
            this.dodgeTimer = 5000;
        }
        if (result == RESULT.GLANCE) {
            dmg *= weapon.glanceReduction;
        }
        if (result == RESULT.CRIT) {
            dmg *= 2;
            this.proccrit();
        }

        return this.dealdamage(dmg, result, spell);
    }
    cast(spell) {
        spell.use();
        let dmg = spell.dmg() * this.mh.modifier;
        let result = this.rollspell(spell);
        let roll = rng(1, 10000);
        this.procattack(spell, this.mh, result);

        if (result == RESULT.DODGE) {
            this.dodgeTimer = 5000;
        }
        if (result == RESULT.CRIT) {
            dmg *= 2 + this.talents.abilitiescrit;
            this.proccrit();
        }

        return this.dealdamage(dmg, result, spell);
    }
    buff(spell) {
        spell.use();
        return 0;
    }
    dealdamage(dmg, result, spell) {
        dmg *= this.stats.dmgmod;
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            dmg *= (1 - this.armorReduction);
            this.addRage(dmg, result, spell);
            return ~~dmg;
        }
        else {
            this.addRage(dmg, result, spell);
            return 0;
        }
    }
    proccrit() {
        if (this.talents.flurry) {
            this.auras.flurry = new Flurry(this.talents.flurry);
            this.updateAuras();
        }
        if (this.spells.deepwounds && this.talents.deepwounds) {
            if (!this.auras.deepwounds)
                this.auras.deepwounds = new DeepWounds();
            else
                this.auras.deepwounds.refresh();
        }
    }
    procattack(spell, weapon, result) {
        if (!spell || spell instanceof HeroicStrike) {
            if (this.auras.flurry && !this.auras.flurry.procattack()) {
                delete this.auras.flurry;
                this.updateAuras();
            }
        }
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            if (this.talents.swordproc && weapon.type == WEAPONTYPE.SWORD) {
                if (rng(1, 10000) < this.talents.swordproc * 100)
                    this.extraattacks++;
            }
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
        let step = 0;
        let max = this.timesecs * 1000;
        while( step < max ) {
            let next = 10;
            let batch = step % 200 == 0;

            if (player.mh.timer >= 200 && player.oh.timer >= 200)
                next = (200 - (step % 200));

            step += next;
            player.step(this, batch, next);

            if (batch && player.extraattacks > 0) 
                while (player.extraattacks--)
                    this.total += player.attack(player.mh, true);

            if (player.mh.timer == 0) {
                this.total += player.attack(player.mh);
                if (player.oh.timer < 200) {
                    player.oh.timer = 200;
                } 
            }
            else if (player.oh.timer == 0) {
                this.total += player.attack(player.oh);
                if (player.mh.timer < 200) {
                    player.mh.timer = 200;
                }
            }

            if (batch && player.timer == 0) {
                if (player.spells.berserkerrage && player.spells.berserkerrage.canUse()) {
                    player.buff(player.spells.berserkerrage);
                    continue;
                }
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
                if (player.spells.bloodrage && player.spells.bloodrage.canUse()) {
                    player.buff(player.spells.bloodrage);
                    continue;
                }
                if (player.spells.deathwish && player.spells.deathwish.canUse()) {
                    player.buff(player.spells.deathwish);
                    continue;
                }
                if (player.spells.heroicstrike && player.spells.heroicstrike.canUse()) {
                    player.buff(player.spells.heroicstrike);
                    continue;
                }
                if (player.spells.jujuflurry && player.spells.jujuflurry.canUse()) {
                    player.buff(player.spells.jujuflurry);
                    continue;
                }
                if (player.spells.ragepotion && player.spells.ragepotion.canUse()) {
                    player.buff(player.spells.ragepotion);
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