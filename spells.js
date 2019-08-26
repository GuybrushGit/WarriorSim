class Spell {
    constructor(player) {
        this.timer = 0;
        this.cost = 0;
        this.cooldown = 0;
        this.player = player;
        this.refund = true;
        this.canDodge = true;
    }
    dmg() {
        return 0;
    }
    use() {
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
    }
    step() {
        this.timer = this.timer < 200 ? 0 : this.timer - 200;
    }
    canUse() {
        return this.timer == 0 && this.cost <= this.player.rage;
    }
}

class Bloodthirst extends Spell {
    constructor(player) {
        super(player);
        this.cost = 30;
        this.cooldown = 6;
    }
    dmg() {
        return this.player.stats.ap * 0.45;
    }
}

class Whirlwind extends Spell {
    constructor(player) {
        super(player);
        this.cost = 25;
        this.cooldown = 10;
        this.refund = false;
    }
    dmg() {
        return rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse() {
        return super.canUse() && (!this.bloodthirst || this.player.bloodthirst.timer > 1500);
    }
}

class Overpower extends Spell {
    constructor(player) {
        super(player);
        this.cost = 5;
        this.cooldown = 5;
        this.canDodge = false;
    }
    dmg() {
        return 35 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    use() {
        this.player.timer = 3000;
        this.player.rage = Math.min(this.player.rage, this.player.talents.rageretained);
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.player.auras.battlestance = new Aura(1.5, { crit: -3 });
        this.player.updateAuras();
    }
    canUse() {
        return super.canUse() && this.player.dodgeTimer > 0;
    }
}

class Execute extends Spell {
    constructor(player) {
        super(player);
        this.basecost = 15 - player.talents.executecost;
        this.usedrage = 0;
    }
    dmg() {
        return 600 + (15 * this.usedrage);
    }
    use() {
        this.player.timer = 1500;
        this.usedrage = ~~(this.player.rage - this.basecost);
        this.cost = this.basecost + this.usedrage;
        this.player.rage = 0;
    }
    canUse() {
        return this.basecost <= this.player.rage;
    }
}

class BattleShout extends Spell {
    constructor(player) {
        super(player);
        this.cost = 10;
        this.ap = ~~(185 * (1 + player.talents.impbattleshout))
        this.cooldown = 120 * (1 + player.talents.boomingvoice);
    }
    use() {
        super.use();
        this.player.auras.battleshout = new Aura(this.cooldown, { ap: this.ap });
        this.player.stats.ap += this.ap;
    }
}

class BerserkerRage extends Spell {
    constructor(player) {
        super(player);
        this.cost = 0;
        this.bonusrage = 0 + player.talents.berserkerbonus;
        this.cooldown = 30;
    }
    use() {
        super.use();
        this.player.rage += this.bonusrage;
    }
    canUse() {
        return super.canUse() && !this.battlestance;
    }
}

class Bloodrage extends Spell {
    constructor(player) {
        super(player);
        this.cost = 0;
        this.rage = 10 + player.talents.bloodragebonus;
        this.cooldown = 60;
    }
    use() {
        super.use();
        this.player.rage += this.rage;
        this.player.auras.bloodrage = new BloodrageAura();
    }
    canUse() {
        return super.canUse() && !this.battlestance;
    }
}

class DeathWish extends Spell {
    constructor(player) {
        super(player);
        this.cost = 10;
        this.cooldown = 180;
    }
    use() {
        super.use();
        this.player.auras.deathwish = new Aura(30, {}, { dmgmod: 20 });
        this.player.updateAuras();
    }
}

class HeroicStrike extends Spell {
    constructor(player) {
        super(player);
        this.cost = 15 - player.talents.impheroicstrike;
    }
    use() {
        super.use();
        this.player.nextswinghs = true;
    }
    canUse() {
        return super.canUse() && !this.player.nextswinghs;
    }
}

class JujuFlurry extends Spell {
    constructor(player) {
        super(player);
        this.cooldown = 60;
    }
    use() {
        super.use();
        this.player.auras.jujuflurry = new Aura(20, {}, {}, { haste: 3 });
        this.player.updateAuras();
    }
}

class RagePotion extends Spell {
    constructor(player) {
        super(player);
        this.cooldown = 120;
    }
    use() {
        super.use();
        this.player.auras.ragepotion = new Aura(20, { str: 60 });
        this.player.updateAuras();
        this.player.rage = Math.max(this.player.rage + ~~rng(45,75), 100);
    }
}

class MortalStrike extends Spell {
    constructor(player) {
        super(player);
        this.cost = 30;
        this.cooldown = 6;
    }
    dmg() {
        return 160 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
}

class Hamstring extends Spell {
    constructor(player) {
        super(player);
        this.cost = 10;
    }
    dmg() {
        return 45;
    }
}

class Recklessness extends Spell {
    constructor(player) {
        super(player);
    }
    use() {
        super.use();
        this.player.auras.recklessness = new Aura(15, { crit: 100 });
        this.player.updateAuras();
        this.player.recklessness = false;
    }
}

class BloodFury extends Spell {
    constructor(player) {
        super(player);
        this.cooldown = 120;
    }
    use() {
        super.use();
        this.player.auras.bloodfury = new Aura(15, {}, { apmod: 25 });
        this.player.updateAuras();
    }
}

class Berserking extends Spell {
    constructor(player) {
        super(player);
        this.cost = 5;
        this.cooldown = 180;
    }
    use() {
        super.use();
        this.player.auras.berserking = new Aura(10, {}, {}, { haste: 30 });
        this.player.updateAuras();
    }
}

class Crusader extends Spell {
    use(offhand) {
        if (offhand)
            this.player.auras.crusader2 = new Aura(15, { str: 100 });
        else
            this.player.auras.crusader1 = new Aura(15, { str: 100 });
        this.player.updateAuras();
    }
}




class Aura {
    constructor(duration, stats, mult_stats, div_stats) {
        this.timer = duration * 1000;
        this.stats = stats || {};
        this.div_stats = div_stats || {};
        this.mult_stats = mult_stats || {};
    }
    step() {
        return this.timer = this.timer < 200 ? 0 : this.timer - 200;
    }
    refresh() {

    }
}

class Flurry extends Aura {
    constructor(percentage) {
        super(12);
        this.stacks = 3;
        this.div_stats = { haste: percentage };
    }
    procattack() {
        this.stacks--;
        return this.stacks > 0;
    }
}

class DeepWounds extends Aura {
    constructor() {
        super(12);
    }
    step(simulation) {
        let timer = super.step();
        if (timer == 0 || timer % 3000 == 0 || timer % 6000 == 0 || timer % 9000 == 0) {
            let player = simulation.player;
            let min = player.mh.mindmg + player.mh.bonusdmg + (player.stats.ap / 14) * player.mh.speed;
            let max = player.mh.maxdmg + player.mh.bonusdmg + (player.stats.ap / 14) * player.mh.speed;
            let dmg = (min + max) / 2;
            dmg *= player.mh.modifier * player.stats.dmgmod * player.talents.deepwounds;
            simulation.total += ~~(dmg / 4);
        }
        return timer;
    }
    refresh() {
        this.timer = 9000 + (this.timer % 3000);
    }
}

class BloodrageAura extends Aura {
    constructor() {
        super(10);
    }
    step(simulation) {
        let timer = super.step();
        if (timer % 1000 == 0)
            simulation.player.rage++;
        return timer;
    }
}
