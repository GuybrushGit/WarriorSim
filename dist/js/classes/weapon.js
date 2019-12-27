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
    constructor(player, item, enchant, tempenchant, offhand) {
        this.player = player;
        this.speed = item.speed;
        this.mindmg = item.mindmg;
        this.maxdmg = item.maxdmg;
        this.type = item.type;
        this.modifier = offhand ? 0.5 * (1 + player.talents.offmod) * (1 + player.talents.onemod) : 1 + player.talents.onemod;
        this.timer = offhand ? this.speed * 1000 : 0;
        this.normSpeed = 2.4;
        this.offhand = offhand;
        this.crit = 0;
        this.basebonusdmg = 0;
        this.bonusdmg = 0;
        this.type = WEAPONTYPE[item.type.toUpperCase()] || 0;
        this.totaldmg = 0;
        this.totalprocdmg = 0;
        this.data = [0,0,0,0,0];
        if (this.type == WEAPONTYPE.AXE || this.type == WEAPONTYPE.BIGAXE) this.crit += player.talents.axecrit;
        if (this.type == WEAPONTYPE.DAGGER) this.normSpeed = 1.7;
        if (this.type == WEAPONTYPE.BIGMACE || this.type == WEAPONTYPE.BIGSWORD || this.type == WEAPONTYPE.BIGAXE) this.normSpeed = 3.3;

        if (item.ppm) {
            this.proc1 = {};
            this.proc1.chance = ~~(item.speed * item.ppm / 0.006);
            if (item.physdmg) this.proc1.physdmg = item.physdmg;
            if (item.magicdmg) this.proc1.magicdmg = item.magicdmg;
            if (item.procextra) this.proc1.extra = item.procextra;
            if (item.procspell) {
               player.auras[item.procspell.toLowerCase()] = eval('new ' + item.procspell + '(player)');
               this.proc1.spell = player.auras[item.procspell.toLowerCase()];
            }
        }
        
        if (enchant && enchant.ppm) {
            this.proc2 = {};
            this.proc2.chance = ~~(this.speed * enchant.ppm / 0.006);
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

        for(let buff of buffs)
            if (buff.bonusdmg && buff.active)
                this.basebonusdmg += buff.bonusdmg;
        if (enchant && enchant.bonusdmg) 
            this.basebonusdmg += enchant.bonusdmg;
        if (tempenchant && tempenchant.bonusdmg) 
            this.basebonusdmg += tempenchant.bonusdmg;
        this.bonusdmg = this.basebonusdmg;
    }
    dmg(heroicstrike) {
        let dmg = rng(this.mindmg + this.bonusdmg, this.maxdmg + this.bonusdmg) + (this.player.stats.ap / 14) * this.speed;
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