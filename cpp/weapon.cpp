#include "weapon.h"
#include "player.h"
#include "items.h"
#include "buffs.h"
#include "talents.h"

Weapon::Weapon( Player& player_, Item& item, Enchant* enchant, Enchant* tempenchant, bool offhand_, bool twohand_ )
    : player( player_ )
    , offhand( offhand_ )
    , twohand( twohand_ )
    , mindmg( item.weapon.mindmg )
    , maxdmg( item.weapon.maxdmg )
    , speed( item.weapon.speed )
    , type( (WeaponType) item.weapon.type )
{
    if ( twohand )
    {
        modifier = 1.0 + player.talents.twomod;
    }
    else if ( offhand )
    {
        modifier = 0.5 * ( 1.0 + player.talents.offmod ) * ( 1.0 + player.talents.onemod );
    }
    else
    {
        modifier = 1.0 + player.talents.onemod;
    }

    if ( type == WEAPON_AXE )
    {
        crit += player.talents.axecrit;
    }
    else if ( type == WEAPON_POLEARM )
    {
        crit += player.talents.polearmcrit;
    }
    else if ( type == WEAPON_DAGGER )
    {
        normSpeed = 1.7;
    }
    if ( twohand )
    {
        normSpeed = 3.3;
    }

    if ( item.proc.ppm )
    {
        auto& proc = proc1.emplace();
        proc.chance = int( speed * item.proc.ppm / 0.006 );
        proc.physdmg = item.proc.physdmg;
        proc.magicdmg = item.proc.magicdmg;
        proc.binaryspell = item.proc.binaryspell != 0;
        proc.coeff = item.proc.coeff;
        proc.extra = item.proc.extra;
        proc.gcd = item.proc.gcd != 0;
        if ( item.proc.spell )
        {
            proc.spell = &item.proc.spell( player );
        }
    }

    if ( enchant && enchant->proc.ppm )
    {
        auto& proc = proc2.emplace();
        proc.chance = int( speed * enchant->proc.ppm / 0.006 );
        proc.magicdmg = enchant->proc.magicdmg;
        if ( enchant->proc.spell )
        {
            proc.spell = &enchant->proc.spell( player );
        }
    }

    for ( auto& buff : Buffs )
    {
        if ( buff.active )
        {
            if ( buff.id == 10614 && !offhand )
            {
                windfury = &player.auras.emplace<Windfury>( player );
            }

            basebonusdmg += buff.stats.bonusdmg;
        }
    }
    if ( enchant )
    {
        basebonusdmg += enchant->stats.bonusdmg;
    }
    if ( !windfury && tempenchant )
    {
        basebonusdmg += tempenchant->stats.bonusdmg;
    }
    if ( includes( player.items, 21189) )
    {
        basebonusdmg += 4;
    }
    bonusdmg = basebonusdmg;
}

double Weapon::dmg( int bonus ) const
{
    double result = ( player.weaponrng ? ( double )rng( mindmg + bonusdmg, maxdmg + bonusdmg ) : double( mindmg + maxdmg ) / 2.0 );
    result += double( bonusdmg + bonus ) + ( ( double )player.stats.ap / 14.0 ) * speed;
    return result * modifier;
}

double Weapon::avgdmg() const
{
    double result = double( mindmg + maxdmg ) / 2.0 + double( bonusdmg ) + ( ( double )player.stats.ap / 14.0 ) * normSpeed;
    return result * modifier * player.stats.dmgmod * ( 1 - player.armorReduction );
}

void Weapon::use()
{
    timer = int( speed * 1000 / player.stats.haste + 0.5 );
}
