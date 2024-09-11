var WEAPONTYPE = {
    MACE: 0,
    SWORD: 1,
    DAGGER: 2,
    AXE: 3,
    FIST: 4,
    POLEARM: 5,
    STAFF: 6,
    FISHINGPOLE: 7,
}

class Weapon {
    constructor(player, item, enchant, tempenchant, offhand, twohand) {
        this.player = player;
        this.name = item.name;
        this.mindmg = item.mindmg;
        this.maxdmg = item.maxdmg;
        this.basemindmg = item.mindmg;
        this.basemaxdmg = item.maxdmg;
        this.type = item.type;
        this.modifier = offhand ? 0.5 * (1 + player.talents.offmod) * (1 + player.talents.onemod) : 1 + player.talents.onemod;
        if (twohand) this.modifier = 1 + player.talents.twomod;
        this.speed = item.speed;
        this.timer = 0;
        this.normSpeed = 2.4;
        this.offhand = offhand;
        this.twohand = twohand;
        this.crit = 0;
        this.basebonusdmg = 0;
        this.bonusdmg = 0;
        this.type = WEAPONTYPE[item.type.replace(' ','').toUpperCase()] || 0;
        this.totaldmg = 0;
        this.totalprocdmg = 0;
        this.data = [0,0,0,0,0];
        if (this.type == WEAPONTYPE.AXE) this.crit += player.talents.axecrit;
        if (this.type == WEAPONTYPE.POLEARM) this.crit += player.talents.polearmcrit;
        if (this.type == WEAPONTYPE.DAGGER) this.normSpeed = 1.7;
        if (this.twohand) this.normSpeed = 3.3;

        if (item.proc) {
            this.proc1 = {};
            this.proc1.chance = item.proc.chance ? item.proc.chance * 100 : ~~(item.speed * (item.proc.ppm || 1) / 0.006);
            if (item.proc.dmg && !item.proc.magic) this.proc1.physdmg = item.proc.dmg;
            if (item.proc.dmg && item.proc.magic) this.proc1.magicdmg = item.proc.dmg;
            if (item.proc.binaryspell) this.proc1.binaryspell = true;
            if (item.proc.coeff) this.proc1.coeff = parseInt(item.proc.coeff);
            if (item.proc.procgcd) this.proc1.gcd = item.proc.procgcd;
            if (item.proc.extra) this.proc1.extra = item.proc.extra;
            if (item.proc.dmg && !item.proc.magic && !item.proc.tick && item.id != 231848) this.proc1.phantom = true;

            // dont need an aura, just add the dmg
            if (item.proc.tick && !item.proc.bleed) {
                let ticks = parseInt(item.proc.duration) / parseInt(item.proc.interval);
                if (item.proc.magic) this.proc1.magicdmg = (item.proc.dmg || 0) + (item.proc.tick * ticks);
                else this.proc1.physdmg = (item.proc.dmg || 0) + (item.proc.tick * ticks);
            }
            // bleeds need aura
            if (item.proc.tick && item.proc.bleed) {
                player.auras["weaponbleed" + (this.offhand ? 'oh' : 'mh')] = new WeaponBleed(player, 0, item.proc.duration, item.proc.interval, item.proc.tick, this.offhand);
                this.proc1.spell = player.auras["weaponbleed" + (this.offhand ? 'oh' : 'mh')];
            }
            // custom spells
            if (item.proc.spell) {
                if (!player.auras[item.proc.spell.toLowerCase()]) {
                    player.auras[item.proc.spell.toLowerCase()] = eval('new ' + item.proc.spell + '(player)');
                }
                this.proc1.spell = player.auras[item.proc.spell.toLowerCase()];
            }
        }
        
        if (enchant && (enchant.ppm || enchant.chance)) {
            this.proc2 = {};
            if (enchant.ppm) this.proc2.chance = ~~(this.speed * enchant.ppm / 0.006);
            if (enchant.chance) this.proc2.chance = enchant.chance * 100;
            if (enchant.magicdmg) this.proc2.magicdmg = enchant.magicdmg;
            if (enchant.procspell && !offhand) {
                player.auras.crusader1 = new Crusader(player);
                player.auras.crusader1.name = 'Crusader (MH)';
                this.proc2.spell = player.auras.crusader1;
            }
            if (enchant.procspell && offhand) {
                player.auras.crusader2 = new Crusader(player);
                player.auras.crusader2.name = 'Crusader (OH)';
                this.proc2.spell = player.auras.crusader2;
            }
        }

        for (let buff of buffs) {
            if (buff.group == "windfury" && buff.active) {
                if (!this.player.auras.windfury && !this.offhand) {
                    this.player.auras.windfury = new Windfury(this.player, buff.id);
                    this.windfury = this.player.auras.windfury;
                }
            }
        }

        if (!this.windfury && !this.proc2 && tempenchant && (tempenchant.ppm || tempenchant.chance)) {
            this.proc2 = {};
            if (tempenchant.ppm) this.proc2.chance = ~~(this.speed * tempenchant.ppm / 0.006);
            if (tempenchant.chance) this.proc2.chance = tempenchant.chance * 100;
            if (tempenchant.magicdmg) this.proc2.magicdmg = tempenchant.magicdmg;
        }

        for(let buff of buffs)
            if (buff.bonusdmg && buff.active)
                this.basebonusdmg += buff.bonusdmg;
        if (enchant && enchant.bonusdmg) 
            this.basebonusdmg += enchant.bonusdmg;
        if (!this.windfury && tempenchant && tempenchant.bonusdmg)
            this.basebonusdmg += tempenchant.bonusdmg;
        this.bonusdmg = this.basebonusdmg;
    }
    dmg(heroicstrike) {
        let dmg;
        let mod = 1;
        dmg = rng(this.mindmg + this.bonusdmg, this.maxdmg + this.bonusdmg) + (this.player.stats.ap / 14) * this.speed + this.player.stats.moddmgdone;
        if (heroicstrike) dmg += heroicstrike.bonus;
        if (heroicstrike && this.player.heroicbonus) mod = 1.1;
        return dmg * this.modifier * this.player.stats.dmgmod * mod + this.player.stats.moddmgtaken;
    }
    avgdmg() {
        let dmg = ((this.mindmg + this.bonusdmg + this.maxdmg + this.bonusdmg)/2) + (this.player.stats.ap / 14) * this.normSpeed + this.player.stats.moddmgdone;
        dmg = dmg * this.modifier * this.player.stats.dmgmod + this.player.stats.moddmgtaken;
        return dmg * (1 - this.player.armorReduction);
    }
    use() {
        this.timer = Math.round(this.speed * 1000 / this.player.stats.haste);
        if (!this.offhand && this.player.spells.slam && this.player.spells.slam.afterswing) this.player.spells.slam.mhthreshold = this.timer - 1000;
    }
    step(next) {
        this.timer -= next;
    }
}
