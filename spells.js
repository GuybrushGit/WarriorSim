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
        this.timer = this.timer < 10 ? 0 : this.timer - 10;
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
        return rng(this.player.mh.mindmg, this.player.mh.maxdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
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
        return 35 + rng(this.player.mh.mindmg, this.player.mh.maxdmg) + (this.player.stats.ap / 14) * this.player.mh.normSpeed;
    }
    canUse() {
        return super.canUse() && this.player.dodgeTimer > 0;
    }
}

class Execute extends Spell {
    constructor(player) {
        super(player);
        this.cost = 15;
        this.usedrage = 0;
    }
    dmg() {
        let dmg = 600 + (15 * this.usedrage);
        this.usedrage = 0;
        return dmg;
    }
    use() {
        super.use();
        this.usedrage = this.player.rage;
        this.player.rage = 0;
    }
}

class Aura {
    constructor() {
        this.duration = 0;
        this.cooldown = 0;
        this.timer = 0;
        this.stats = {};
        this.n_stats = {};
    }
    step() {
        this.timer = this.timer < 10 ? 0 : this.timer - 10;
    }
    procattack() {
        return true;
    }
}

class Flurry extends Aura {
    constructor() {
        super();
        this.stacks = 3;
        this.duration = 12;
        this.n_stats = { speedmod: 30 };
    }
    procattack() {
        this.stacks--;
        return this.stacks > 0;
    }
}