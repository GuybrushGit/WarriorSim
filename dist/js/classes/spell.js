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
        this.timer = this.timer < 400 ? 0 : this.timer - 400;
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
        this.threshold = parseInt(spells[5].minrage);
    }
    dmg() {
        return rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse() {
        return this.timer == 0 && this.cost <= this.player.rage && this.player.rage >= this.threshold && !this.battlestance;
    }
}

class Overpower extends Spell {
    constructor(player) {
        super(player);
        this.cost = 5;
        this.cooldown = 5;
        this.canDodge = false;
        this.threshold = parseInt(spells[9].maxrage);
    }
    dmg() {
        return 35 + rng(this.player.mh.mindmg + this.player.mh.bonusdmg, this.player.mh.maxdmg + this.player.mh.bonusdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    use() {
        this.player.timer = 2000;
        this.player.dodgeTimer = 0;
        this.player.rage = Math.min(this.player.rage, this.player.talents.rageretained);
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.player.auras.battlestance.use();
    }
    canUse() {
        return this.timer == 0 && this.cost <= this.player.rage && this.player.dodgeTimer > 0 && this.player.rage <= this.threshold;
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
        this.cooldown = 120 * (1 + player.talents.boomingvoice);
        this.player.auras.battleshout = new BattleShoutAura(player);
    }
    use() {
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.player.auras.battleshout.use();
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
        this.player.timer = 1500;
        this.player.rage -= this.cost;
        this.timer = this.cooldown * 1000;
        this.player.rage += this.bonusrage;
    }
    canUse() {
        return this.timer == 0 && !this.battlestance;
    }
}

class Bloodrage extends Spell {
    constructor(player) {
        super(player);
        this.cost = 0;
        this.rage = 20 + player.talents.bloodragebonus;
        this.threshold = 100 - this.rage;
        this.cooldown = 60;
    }
    use() {
        this.player.timer = 400;
        this.timer = this.cooldown * 1000;
        this.player.rage += this.rage;
    }
    canUse() {
        return this.timer == 0 && !this.battlestance && this.player.rage < this.threshold;
    }
}

class HeroicStrike extends Spell {
    constructor(player) {
        super(player);
        this.cost = 15 - player.talents.impheroicstrike;
        this.threshold = parseInt(spells[2].minrage);
    }
    use() {
        this.player.timer = 400;
        this.player.nextswinghs = true;
    }
    canUse() {
        return this.player.rage >= this.threshold && this.cost <= this.player.rage && !this.player.nextswinghs;
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
        this.threshold = (player.spells.bloodthirst || player.spells.mortalstrike ? 40 : 0);
    }
    dmg() {
        return 45;
    }
    canUse() {
        return this.timer == 0 && this.player.rage >= this.threshold && this.cost <= this.player.rage;
    }
}




class Aura {
    constructor(player) {
        this.timer = 0;
        this.stats = {};
        this.div_stats = {};
        this.mult_stats = {};
        this.player = player;
        this.firstuse = true;
        this.duration = 0;
        this.stacks = 0;
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.updateAuras();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAuras();
        }
        else {
            this.timer -= 400;
        }
    }
}

class Recklessness extends Aura {
    constructor(player) {
        super(player);
        this.duration = 15;
        this.stats = { crit: 100 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.timer = 1500;
        this.player.updateAuras();
    }
    canUse() {
        return this.firstuse && !this.timer;
    }
}

class Flurry extends Aura {
    constructor(player, percentage) {
        super(player);
        this.duration = 12;
        this.div_stats = { haste: player.talents.flurry };
    }
    step() {
        this.stacks--;
        if (!this.stacks) {
            this.timer = 0;
            this.player.updateHaste();
        }
    }
    use() {
        this.stacks = 3;
        this.timer = 1;
        this.player.updateHaste();
    }
}

class DeepWounds extends Aura {
    constructor(player) {
        super(player);
        this.duration = 12;
    }
    step(simulation) {
        this.timer = this.timer < 200 ? 0 : this.timer - 200;
        if (this.timer == 0 || this.timer % 3000 == 0 || this.timer % 6000 == 0 || this.timer % 3000 == 0) {
            let min = this.player.mh.mindmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
            let max = this.player.mh.maxdmg + this.player.mh.bonusdmg + (this.player.stats.ap / 14) * this.player.mh.speed;
            let dmg = (min + max) / 2;
            dmg *= this.player.mh.modifier * this.player.stats.dmgmod * this.player.talents.deepwounds;
            simulation.idmg += ~~(dmg / 4);
        }
    }
    use() {
        if (!this.timer) this.timer = this.duration * 1000;
        else this.timer = 9000 + (this.timer % 3000);
    }
}

class Crusader extends Aura {
    constructor(player) {
        super(player);
        this.duration = 15;
        this.stats = { str: 100 };
    }
}

class Cloudkeeper extends Aura {
    constructor(player) {
        super(player);
        this.duration = 30;
        this.stats = { ap: 100 };
    }
    canUse() {
        return this.firstuse && !this.timer;
    }
}

class Felstriker extends Aura {
    constructor(player) {
        super(player);
        this.duration = 3;
        this.stats = { crit: 100, hit: 100 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.update();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.update();
        }
        else {
            this.timer -= 400;
        }
    }
}

class BattleShoutAura extends Aura {
    constructor(player) {
        super(player);
        this.stats = { ap: ~~(185 * (1 + player.talents.impbattleshout)) };
        this.duration = 120 * (1 + player.talents.boomingvoice);
    }
}

class DeathWish extends Aura {
    constructor(player) {
        super(player);
        this.duration = 30;
        this.mult_stats = { dmgmod: 20 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.rage -= 10;
        this.player.timer = 1500;
        this.player.updateAuras();
    }
    canUse() {
        return this.firstuse && !this.timer && this.player.rage >= 10;
    }
}

class BattleStance extends Aura {
    constructor(player) {
        super(player);
        this.duration = 2;
        this.stats = { crit: -3 };
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateAuras();
            this.player.rage = Math.min(this.player.rage, this.player.talents.rageretained);
        }
        else {
            this.timer -= 400;
        }
    }
}

class JujuFlurry extends Aura {
    constructor(player) {
        super(player);
        this.div_stats = { haste: 3 };
        this.duration = 20;
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.timer = 400;
        this.player.updateHaste();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
        }
        else {
            this.timer -= 400;
        }
    }
    canUse() {
        return this.firstuse && !this.timer;
    }
}

class MightyRagePotion extends Aura {
    constructor(player) {
        super(player);
        this.stats = { str: 60 };
        this.duration = 20;
        this.threshold = parseInt(spells[13].maxrage);
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.rage = Math.min(this.player.rage + ~~rng(45, 75), 100);
        this.player.timer = 400;
        this.player.updateAuras();
    }
    canUse() {
        return this.firstuse && !this.timer && this.player.rage <= this.threshold;
    }
}

class BloodFury extends Aura {
    constructor(player) {
        super(player);
        this.duration = 15;
        this.mult_stats = { apmod: 25 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.timer = 1500;
        this.player.updateAuras();
    }
    canUse() {
        return this.firstuse && !this.timer;
    }
}

class Berserking extends Aura {
    constructor(player) {
        super(player);
        this.duration = 10;
        this.div_stats = { haste: 30 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.rage -= 5;
        this.player.timer = 1500;
        this.player.updateHaste();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
        }
        else {
            this.timer -= 400;
        }
    }
    canUse() {
        return this.firstuse && !this.timer && this.player.rage >= 5;
    }
}

class Empyrean extends Aura {
    constructor(player) {
        super(player);
        this.duration = 10;
        this.div_stats = { haste: 20 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.updateHaste();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
        }
        else {
            this.timer -= 400;
        }
    }
}

class Eskhandar extends Aura {
    constructor(player) {
        super(player);
        this.duration = 5;
        this.div_stats = { haste: 30 };
    }
    use() {
        this.timer = this.duration * 1000;
        this.player.updateHaste();
    }
    step() {
        if (this.timer <= 400) {
            this.timer = 0;
            this.firstuse = false;
            this.player.updateHaste();
        }
        else {
            this.timer -= 400;
        }
    }
}

