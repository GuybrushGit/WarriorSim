#include "player.h"
#include "bindings.h"
#include "items.h"
#include "buffs.h"
#include "talents.h"

Player::Player( Simulation& sim, const Config& cfg, const Talents& talents_ )
    : simulation( sim )
    , talents( talents_ )
{
    race = cfg.player.race;
    aqbooks = cfg.player.aqbooks != 0;
    weaponrng = cfg.player.weaponrng != 0;
    spelldamage = cfg.player.spelldamage;
    if ( cfg.player.enchType == 1 )
    {
        testEnch = cfg.player.testId;
        testEnchType = cfg.player.testType;
    }
    else if ( cfg.player.enchType == 2 )
    {
        testTempEnch = cfg.player.testId;
        testTempEnchType = cfg.player.testType;
    }
    else if ( cfg.player.enchType == 3 )
    {
        if ( cfg.player.testType == 0 )
        {
            base.ap += cfg.player.testId;
        }
        else if ( cfg.player.testType == 1 )
        {
            base.crit += cfg.player.testId;
        }
        else if ( cfg.player.testType == 2 )
        {
            base.hit += cfg.player.testId;
        }
        else if ( cfg.player.testType == 3 )
        {
            base.str += cfg.player.testId;
        }
    }
    else
    {
        testItem = cfg.player.testId;
        testItemType = cfg.player.testType;
    }
    target = cfg.target;
    base.skill[0] = level * 5;
    base.skill[1] = level * 5;
    base.skill[2] = level * 5;
    base.skill[3] = level * 5;
    base.skill[4] = level * 5;
    base.skill[5] = level * 5;

    addRace();
    addGear();
    if ( !mh ) return;
    addSets();
    addEnchants();
    addTempEnchants();
    addBuffs();
    addSpells();

    if ( talents.flurry ) auras.emplace<Flurry>( *this );
    if ( talents.deepwounds ) auras.emplace<DeepWounds>( *this );
    if ( spells.has<Overpower>() ) auras.emplace<BattleStance>( *this );
    if ( spells.has<Bloodrage>() ) auras.emplace<BloodrageAura>( *this );
    if ( includes( items, 9449 ) ) auras.emplace<Pummeler>( *this );
    if ( includes( items, 14554 ) ) auras.emplace<Cloudkeeper>( *this );
    if ( includes( items, 20130 ) ) auras.emplace<Flask>( *this );
    if ( includes( items, 23041 ) ) auras.emplace<Slayer>( *this );
    if ( includes( items, 22954 ) ) auras.emplace<Spider>( *this );
    if ( includes( items, 23570 ) ) auras.emplace<Gabbar>( *this );
    if ( includes( items, 21180 ) ) auras.emplace<Earthstrike>( *this );
    if ( includes( items, 21670 ) ) auras.emplace<Swarmguard>( *this );
    if ( includes( items, 19949 ) ) auras.emplace<Zandalarian>( *this );

    update();

    if ( oh )
    {
        oh->timer = int( oh->speed * 1000.0 / stats.haste / 2.0 + 0.5 );
    }
}

void Player::addRace()
{
    auto& info = races[race];
    base.aprace = info.ap;
    base.ap += info.ap;
    base.str += info.str;
    base.agi += info.agi;
    for ( int i = 0; i < NUM_WEAPON_TYPES; ++i )
    {
        base.skill[i] += info.skill[i];
    }
}

void Player::addGear()
{
    for ( int type = 0; type < NUM_ITEM_SLOTS; ++type )
    {
        for ( auto& item : Items[type] )
        {
            if ( testItemType == type ? testItem == item.id : item.selected )
            {
                base.str += item.stats.str;
                base.agi += item.stats.agi;
                base.ap += item.stats.ap;
                base.crit += item.stats.crit;
                base.hit += item.stats.hit;
                for ( int i = 0; i < NUM_WEAPON_TYPES; ++i )
                {
                    base.skill[i] += item.stats.skill[i];
                }

                if ( type == ITEM_MAINHAND || type == ITEM_OFFHAND || type == ITEM_TWOHAND )
                {
                    addWeapon( item, type );
                }

                if ( item.proc.chance )
                {
                    auto& proc = attackproc.emplace_back();
                    proc.chance = item.proc.chance * 100;
                    proc.magicdmg = item.proc.magicdmg;
                    proc.extra = item.proc.extra;
                    if ( item.proc.spell )
                    {
                        proc.spell = &item.proc.spell( *this );
                    }
                }

                items.push_back( item.id );
            }
        }
    }

    // remove weapon skill if using 2H
    if ( mh && mh->twohand )
    {
        for ( int type = 0; type < NUM_ITEM_SLOTS; ++type )
        {
            if ( type != ITEM_HEAD && type != ITEM_HANDS )
            {
                continue;
            }
            for ( auto& item : Items[type] )
            {
                if ( testItemType == type ? testItem == item.id : item.selected )
                {
                    for ( int i = 0; i < NUM_WEAPON_TYPES; ++i )
                    {
                        base.skill[i] -= item.stats.skill[i];
                    }
                }
            }
        }
    }
}

void Player::addWeapon( Item& item, int type )
{
    Enchant* ench = nullptr;
    Enchant* tempench = nullptr;

    for ( auto& item : Enchants[type] )
    {
        if ( item.temp )
        {
            if ( testTempEnchType == type ? testTempEnch == item.id : item.selected )
            {
                tempench = &item;
            }
        }
        else
        {
            if ( testEnchType == type ? testEnch == item.id : item.selected )
            {
                ench = &item;
            }
        }
    }

    if ( type == ITEM_MAINHAND )
    {
        mh.emplace( *this, item, ench, tempench, false, false );
    }
    else if ( type == ITEM_OFFHAND )
    {
        oh.emplace( *this, item, ench, tempench, true, false );
    }
    else if ( type == ITEM_TWOHAND )
    {
        mh.emplace( *this, item, ench, tempench, false, true );
    }
}

void Player::addEnchants()
{
    for ( int type = 0; type < NUM_ITEM_SLOTS; ++type )
    {
        for ( auto& item : Enchants[type] )
        {
            if ( !item.temp && ( testEnchType == type ? testEnch == item.id : item.selected ) )
            {
                base.str += item.stats.str;
                base.agi += item.stats.agi;
                base.ap += item.stats.ap;
                base.crit += item.stats.crit;
                if ( item.stats.haste )
                {
                    base.haste *= 1.0 + ( double )item.stats.haste / 100.0;
                }
            }
        }
    }
}

void Player::addTempEnchants()
{
    for ( int type = 0; type < NUM_ITEM_SLOTS; ++type )
    {
        if ( ( type == ITEM_MAINHAND || type == ITEM_TWOHAND ) && mh->windfury )
        {
            continue;
        }
        for ( auto& item : Enchants[type] )
        {
            if ( item.temp && ( testTempEnchType == type ? testTempEnch == item.id : item.selected ) )
            {
                base.str += item.stats.str;
                base.agi += item.stats.agi;
                base.ap += item.stats.ap;
                base.crit += item.stats.crit;
                if ( item.stats.haste )
                {
                    base.haste *= 1.0 + ( double )item.stats.haste / 100.0;
                }
            }
        }
    }
}

void Player::addSets()
{
    for ( auto& set : Sets )
    {
        int counter = 0;
        for ( int id : set.items )
        {
            if ( id && includes( items, id ) )
            {
                counter += 1;
            }
        }
        if ( !counter )
        {
            continue;
        }
        for ( auto& bonus : set.bonuses )
        {
            if ( bonus.count && counter >= bonus.count )
            {
                base.ap += bonus.stats.ap;
                base.hit += bonus.stats.hit;
                base.crit += bonus.stats.crit;
                base.skill[1] += bonus.stats.skill_1;
                if ( bonus.stats.dmgmod )
                {
                    base.dmgmod *= 1.0 + 0.01 * ( double )bonus.stats.dmgmod;
                }
                if ( bonus.stats.enhancedbs )
                {
                    enhancedbs = true;
                }

                if ( bonus.proc.chance )
                {
                    auto& proc = attackproc.emplace_back();
                    proc.chance = bonus.proc.chance * 100;
                    proc.spell = &bonus.proc.spell( *this );
                }
            }
        }
    }
}

void Player::addBuffs()
{
    for ( auto& buff : Buffs )
    {
        if ( buff.active )
        {
            int apbonus = 0;
            if ( buff.id == 27578 || buff.id == 23563 )
            {
                int shoutap = ( aqbooks ? buff.stats.ap + 39 : buff.stats.ap );
                if ( buff.id == 27578 && enhancedbs ) shoutap += 30;
                shoutap = int( ( double )shoutap * ( 1.0 + talents.impbattleshout ) );
                apbonus = shoutap - buff.stats.ap;
            }

            if ( buff.id == 2458 ) zerkstance = true;
            if ( buff.id == 23513 ) vaelbuff = true;
            if ( buff.id == 12217 ) dragonbreath = true;

            base.ap += buff.stats.ap + apbonus;
            base.agi += buff.stats.agi;
            base.str += buff.stats.str;
            base.crit += buff.stats.crit;
            base.hit += buff.stats.hit;
            base.spellcrit += buff.stats.spellcrit;
            if ( buff.stats.agimod ) base.agimod *= 1.0 + 0.01 * ( double )buff.stats.agimod;
            if ( buff.stats.strmod ) base.strmod *= 1.0 + 0.01 * ( double )buff.stats.strmod;
            if ( buff.stats.dmgmod ) base.dmgmod *= 1.0 + 0.01 * ( double )buff.stats.dmgmod;
            if ( buff.stats.haste ) base.haste *= 1.0 + 0.01 * ( double )buff.stats.haste;

            if ( buff.id == 19838 && aqbooks ) base.ap += 36;
            if ( buff.id == 10627 && aqbooks ) base.agi += 10;
            if ( buff.id == 10442 && aqbooks ) base.str += 16;
        }
    }
}

void Player::addSpells()
{
    if ( Bloodthirst::options.active ) spells.emplace<Bloodthirst>( *this );
    if ( MortalStrike::options.active ) spells.emplace<MortalStrike>( *this );
    if ( HeroicStrike::options.active ) spells.emplace<HeroicStrike>( *this );
    if ( Execute::options.active ) spells.emplace<Execute>( *this );
    if ( Whirlwind::options.active ) spells.emplace<Whirlwind>( *this );
    if ( Overpower::options.active ) spells.emplace<Overpower>( *this );
    if ( Bloodrage::options.active ) spells.emplace<Bloodrage>( *this );
    if ( SunderArmor::options.active ) spells.emplace<SunderArmor>( *this );
    if ( Hamstring::options.active ) spells.emplace<Hamstring>( *this );
    if ( HeroicStrikeExecute::options.active ) spells.emplace<HeroicStrikeExecute>( *this );

    if ( DeathWish::options.active ) auras.emplace<DeathWish>( *this );
    if ( Recklessness::options.active ) auras.emplace<Recklessness>( *this );
    if ( Berserking::options.active ) auras.emplace<Berserking>( *this );
    if ( BloodFury::options.active ) auras.emplace<BloodFury>( *this );
    if ( MightyRagePotion::options.active ) auras.emplace<MightyRagePotion>( *this );
}

void Player::reset( double rage_ )
{
    rage = rage_;
    timer = 0;
    itemtimer = 0;
    dodgetimer = 0;
    spelldelay = 0;
    heroicdelay = 0;
    mh->timer = 0;
    if ( oh )
    {
        oh->timer = int( oh->speed * 1000.0 / stats.haste / 2.0 + 0.5 );
    }
    extraattacks = 0;
    batchedextras = 0;
    nextswinghs = false;
    nextswingcl = false;

    spells.for_each( []( Spell& spell )
    {
        spell.timer = 0;
        spell.stacks = 0;
    } );
    auras.for_each( []( Aura& aura )
    {
        aura.timer = 0;
        aura.firstuse = true;
        aura.stacks = 0;
    } );

    update();
}

void Player::update()
{
    updateAuras();
    updateArmorReduction();

    mh->glanceChance = getGlanceChance( *mh );
    mh->miss = getMissChance( *mh );
    mh->dwmiss = mh->miss;
    mh->dodge = getDodgeChance( *mh );

    if ( oh )
    {
        mh->dwmiss = getDWMissChance( *mh );
        oh->glanceChance = getGlanceChance( *oh );
        oh->miss = getMissChance( *oh );
        oh->dwmiss = getDWMissChance( *oh );
        oh->dodge = getDodgeChance( *oh );
    }
}

void Player::updateAuras()
{
    stats = base;
    auras.for_each( [this]( Aura& aura )
    {
        if ( aura.timer )
        {
            stats.str += aura.stats.str;
            stats.ap += aura.stats.ap;
            stats.crit += aura.stats.crit;
            stats.hit += aura.stats.hit;

            if ( aura.mult_stats.haste ) stats.haste *= 1.0 + 0.01 * ( double )aura.mult_stats.haste;
            if ( aura.mult_stats.dmgmod ) stats.dmgmod *= 1.0 + 0.01 * ( double )aura.mult_stats.dmgmod;
            if ( aura.mult_stats.apmod ) stats.apmod *= 1.0 + 0.01 * ( double )aura.mult_stats.apmod;
        }
    } );
    stats.str = int( ( double )stats.str * stats.strmod );
    stats.agi = int( ( double )stats.agi * stats.agimod );
    stats.ap += stats.str * 2;
    crit = getCritChance();

    if ( stats.apmod != 1.0 )
    {
        stats.ap += int( double( base.aprace + stats.str * 2 ) * ( stats.apmod - 1.0 ) );
    }
}

void Player::updateStrength()
{
    stats.str = base.str;
    stats.ap = base.ap;
    auras.for_each( [this]( Aura& aura )
    {
        if ( aura.timer )
        {
            stats.str += aura.stats.str;
            stats.ap += aura.stats.ap;
        }
    } );
    stats.str = int( ( double )stats.str * stats.strmod );
    stats.ap += stats.str * 2;
    if ( stats.apmod != 1.0 )
    {
        stats.ap += int( double( base.aprace + stats.str * 2 ) * ( stats.apmod - 1.0 ) );
    }
}

void Player::updateAP()
{
    stats.ap = base.ap;
    auras.for_each( [this]( Aura& aura )
    {
        if ( aura.timer )
        {
            stats.ap += aura.stats.ap;
        }
    } );
    stats.ap += stats.str * 2;
    if ( stats.apmod != 1.0 )
    {
        stats.ap += int( double( base.aprace + stats.str * 2 ) * ( stats.apmod - 1.0 ) );
    }
}

void Player::updateHaste()
{
    stats.haste = base.haste;
    if ( auto aura = auras.ptr<Flurry>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
    if ( auto aura = auras.ptr<Berserking>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
    if ( auto aura = auras.ptr<Empyrean>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
    if ( auto aura = auras.ptr<Eskhandar>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
    if ( auto aura = auras.ptr<Pummeler>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
    if ( auto aura = auras.ptr<Spider>(); aura && aura->timer )
    {
        stats.haste *= 1.0 + 0.01 * ( double )aura->mult_stats.haste;
    }
}

void Player::updateBonusDmg()
{
    int bonus = 0;
    if ( auto aura = auras.ptr<Zeal>(); aura && aura->timer )
    {
        bonus += aura->stats.bonusdmg;
    }
    if ( auto aura = auras.ptr<Zandalarian>(); aura && aura->timer )
    {
        bonus += aura->stats.bonusdmg;
    }
    mh->bonusdmg = mh->basebonusdmg + bonus;
    if ( oh )
    {
        oh->bonusdmg = oh->basebonusdmg + bonus;
    }
}

void Player::updateArmorReduction()
{
    target.armor = target.basearmor;
    if ( auto aura = auras.ptr<Annihilator>(); aura && aura->timer )
    {
        target.armor = std::max( target.armor - aura->armor * aura->stacks, 0 );
    }
    if ( auto aura = auras.ptr<RivenspikeMH>(); aura && aura->timer )
    {
        target.armor = std::max( target.armor - aura->armor * aura->stacks, 0 );
    }
    if ( auto aura = auras.ptr<RivenspikeOH>(); aura && aura->timer )
    {
        target.armor = std::max( target.armor - aura->armor * aura->stacks, 0 );
    }
    if ( auto aura = auras.ptr<Bonereaver>(); aura && aura->timer )
    {
        target.armor = std::max( target.armor - aura->armor * aura->stacks, 0 );
    }
    if ( auto aura = auras.ptr<Swarmguard>(); aura && aura->timer )
    {
        target.armor = std::max( target.armor - aura->armor * aura->stacks, 0 );
    }
    armorReduction = getArmorReduction();
}

void Player::updateDmgMod()
{
    stats.dmgmod = base.dmgmod;
    auras.for_each( [this]( Aura& aura )
    {
        if ( aura.timer && aura.mult_stats.dmgmod )
        {
            stats.dmgmod *= 1.0 + 0.01 * ( double )aura.mult_stats.dmgmod;
        }
    } );
}

double Player::getGlanceReduction( Weapon& weapon )
{
    int diff = target.defense - stats.skill[weapon.type];
    double low = std::min( 1.3 - 0.05 * diff, 0.91 );
    double high = std::min( 1.2 - 0.03 * diff, 0.99 );
    if ( weaponrng )
    {
        return randreal() * ( high - low ) + low;
    }
    else
    {
        return ( low + high ) / 2.0;
    }
}

int Player::getGlanceChance( Weapon& weapon )
{
    return 1000 + ( target.defense - std::min( level * 5, stats.skill[weapon.type] ) ) * 200;
}

int Player::getMissChance( Weapon& weapon )
{
    int diff = target.defense - stats.skill[weapon.type];
    int miss = 500 + ( diff > 10 ? diff * 20 : diff * 10 );
    miss -= ( diff > 10 ? stats.hit - 1 : stats.hit ) * 100;
    return miss;
}

int Player::getDWMissChance( Weapon& weapon )
{
    int diff = target.defense - stats.skill[weapon.type];
    int miss = 500 + ( diff > 10 ? diff * 20 : diff * 10 );
    miss = miss * 4 / 5 + 2000;
    miss -= ( diff > 10 ? stats.hit - 1 : stats.hit ) * 100;
    return miss;
}

int Player::getCritChance()
{
    return std::max( 0, 100 * ( stats.crit + talents.crit ) + 5 * stats.agi + 160 * ( level - target.level ) );
}

int Player::getDodgeChance( Weapon& weapon )
{
    return 500 + ( target.defense - stats.skill[weapon.type] ) * 10;
}

double Player::getArmorReduction()
{
    double r = ( double )target.armor / ( ( double )target.armor + 400.0 + 85.0 * level );
    return std::min( r, 0.75 );
}

void Player::addRage( double dmg, Result result, Weapon& weapon, Spell* spell )
{
    if ( !spell || dynamic_cast<HeroicStrike*>( spell ) || dynamic_cast<HeroicStrikeExecute*>( spell ) )
    {
        if ( result != RESULT_MISS && result != RESULT_DODGE && talents.unbridledwrath && rng10k() < talents.unbridledwrath * 100 )
        {
            rage += 1.0;
        }
    }
    if ( spell )
    {
        if ( auto exe = dynamic_cast<Execute*>( spell ) )
        {
            exe->result = result;
        }
        if ( result == RESULT_MISS || result == RESULT_DODGE )
        {
            rage += spell->refund ? ( double )spell->cost * 0.8 : 0;
        }
    }
    else
    {
        if ( result == RESULT_DODGE )
        {
            rage += ( weapon.avgdmg() / 230.6 ) * 7.5 * 0.75;
        }
        else if ( result != RESULT_MISS )
        {
            rage += ( dmg / 230.6 ) * 7.5;
        }
    }
    if ( rage > 100.0 )
    {
        rage = 100.0;
    }
}

bool Player::steptimer( int a )
{
    timer = std::max( 0, timer - a );
    return timer == 0;
}

bool Player::stepitemtimer( int a )
{
    itemtimer = std::max( 0, itemtimer - a );
    return itemtimer == 0;
}

bool Player::stepdodgetimer( int a )
{
    dodgetimer = std::max( 0, dodgetimer - a );
    return dodgetimer == 0;
}

void Player::stepauras()
{
    if ( mh->proc1 && mh->proc1->spell && mh->proc1->spell->timer ) mh->proc1->spell->step();
    if ( mh->proc2 && mh->proc2->spell && mh->proc2->spell->timer ) mh->proc2->spell->step();
    if ( oh && oh->proc1 && oh->proc1->spell && oh->proc1->spell->timer ) oh->proc1->spell->step();
    if ( oh && oh->proc2 && oh->proc2->spell && oh->proc2->spell->timer ) oh->proc2->spell->step();

    if ( auto* aura = auras.ptr<MightyRagePotion>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Recklessness>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<DeathWish>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Cloudkeeper>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Flask>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<BattleStance>(); aura && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<BloodFury>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Berserking>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Slayer>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Spider>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Earthstrike>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Pummeler>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Swarmguard>(); aura && aura->firstuse && aura->timer ) aura->step();
    if ( auto* aura = auras.ptr<Zandalarian>(); aura && aura->firstuse && aura->timer ) aura->step();

    if ( mh->windfury && mh->windfury->timer ) mh->windfury->step();
    for ( auto& proc : attackproc )
    {
        if ( proc.spell && proc.spell->timer ) proc.spell->step();
    }

    if ( auto* aura = auras.ptr<DeepWounds>(); aura && aura->timer ) aura->step();
}

void Player::endauras()
{
    if ( mh->proc1 && mh->proc1->spell && mh->proc1->spell->timer ) mh->proc1->spell->end();
    if ( mh->proc2 && mh->proc2->spell && mh->proc2->spell->timer ) mh->proc2->spell->end();
    if ( oh && oh->proc1 && oh->proc1->spell && oh->proc1->spell->timer ) oh->proc1->spell->end();
    if ( oh && oh->proc2 && oh->proc2->spell && oh->proc2->spell->timer ) oh->proc2->spell->end();

    if ( auto* aura = auras.ptr<MightyRagePotion>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Recklessness>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<DeathWish>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Cloudkeeper>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Flask>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<BattleStance>(); aura && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<BloodFury>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Berserking>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Slayer>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Spider>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Earthstrike>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Pummeler>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Swarmguard>(); aura && aura->firstuse && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<Zandalarian>(); aura && aura->firstuse && aura->timer ) aura->end();

    if ( mh->windfury && mh->windfury->timer ) mh->windfury->end();
    for ( auto& proc : attackproc )
    {
        if ( proc.spell && proc.spell->timer ) proc.spell->end();
    }

    if ( auto* aura = auras.ptr<Flurry>(); aura && aura->timer ) aura->end();
    if ( auto* aura = auras.ptr<DeepWounds>(); aura && aura->timer ) aura->end();
}

Result Player::rollweapon( Weapon& weapon )
{
    int roll = rng10k();
    roll -= std::max( nextswinghs ? weapon.miss : weapon.dwmiss, 0 );
    if ( roll < 0 ) return RESULT_MISS;
    roll -= weapon.dodge;
    if ( roll < 0 ) return RESULT_DODGE;
    roll -= weapon.glanceChance;
    if ( roll < 0 ) return RESULT_GLANCE;
    roll -= crit + weapon.crit * 100;
    if ( roll < 0 ) return RESULT_CRIT;
    return RESULT_HIT;
}

Result Player::rollspell( Spell& spell )
{
    int roll = rng10k();
    roll -= std::max( mh->miss, 0 );
    if ( roll < 0 ) return RESULT_MISS;
    if ( spell.canDodge )
    {
        roll -= mh->dodge;
        if ( roll < 0 ) return RESULT_DODGE;
    }
    if ( spell.nocrit ) return RESULT_HIT;
    if ( !spell.weaponspell )
    {
        roll = rng10k();
    }
    roll -= crit + mh->crit * 100;
    if ( dynamic_cast<Overpower*>( &spell ) )
    {
        roll -= talents.overpowercrit * 100;
    }
    if ( roll < 0 ) return RESULT_CRIT;
    return RESULT_HIT;
}

int Player::attackmh( Weapon& weapon )
{
    stepauras();

    Spell* spell = nullptr;
    int bonus = 0;
    Result result;

    if ( nextswinghs )
    {
        nextswinghs = false;
        if ( auto* ptr = spells.ptr<HeroicStrike>(); ptr && ptr->cost <= rage )
        {
            result = rollspell( *ptr );
            spell = ptr;
            bonus = ptr->bonus;
            rage -= spell->cost;
        }
        else if ( auto* ptr = spells.ptr<HeroicStrikeExecute>(); ptr && ptr->cost <= rage )
        {
            result = rollspell( *ptr );
            spell = ptr;
            bonus = ptr->bonus;
            rage -= spell->cost;
        }
        else
        {
            result = rollweapon( weapon );
        }
    }
    else
    {
        result = rollweapon( weapon );
    }

    double dmg = weapon.dmg( bonus );
    int procdmg = procattack( spell, weapon, result );

    if ( result == RESULT_DODGE )
    {
        dodgetimer = 5000;
    }
    if ( result == RESULT_GLANCE )
    {
        dmg *= getGlanceReduction( weapon );
    }
    if ( result == RESULT_CRIT )
    {
        dmg *= 2.0 + ( spell ? talents.abilitiescrit : 0.0 );
        proccrit();
    }

    weapon.use();
    int done = dealdamage( dmg, result, weapon, spell );
    if ( spell )
    {
        spell->totaldmg += done;
        spell->data[result] += 1;
    }
    else
    {
        weapon.totaldmg += done;
        weapon.data[result] += 1;
    }
    weapon.totalprocdmg += procdmg;

    //std::cout << simulation.step << " Main hand: " << done << " + " << procdmg << std::endl;

    return done + procdmg;
}

int Player::attackoh( Weapon& weapon )
{
    stepauras();

    Result result = rollweapon( weapon );
    double dmg = weapon.dmg();
    int procdmg = procattack( nullptr, weapon, result );

    if ( result == RESULT_DODGE )
    {
        dodgetimer = 5000;
    }
    if ( result == RESULT_GLANCE )
    {
        dmg *= getGlanceReduction( weapon );
    }
    if ( result == RESULT_CRIT )
    {
        dmg *= 2.0;
        proccrit();
    }

    weapon.use();
    int done = dealdamage( dmg, result, weapon, nullptr );
    weapon.totaldmg += done;
    weapon.data[result] += 1;
    weapon.totalprocdmg += procdmg;

    //std::cout << simulation.step << " Off hand: " << done << " + " << procdmg << std::endl;

    return done + procdmg;
}

int Player::cast( Castable* castable )
{
    stepauras();

    castable->use();
    if ( castable->useonly ) return 0;
    auto* spell = dynamic_cast<Spell*>( castable );
    if ( !spell ) return 0; // Shouldn't happen

    double dmg = spell->dmg() * mh->modifier;
    Result result = rollspell( *spell );
    int procdmg = procattack( spell, *mh, result );

    if ( result == RESULT_DODGE )
    {
        dodgetimer = 5000;
    }
    if ( result == RESULT_CRIT )
    {
        dmg *= 2.0 + talents.abilitiescrit;
        proccrit();
    }

    int done = dealdamage( dmg, result, *mh, spell );
    spell->data[result] += 1;
    spell->totaldmg += done;
    mh->totalprocdmg += procdmg;

    //std::cout << simulation.step << " " << castable->name() << ": " << done << " + " << procdmg << std::endl;

    return done + procdmg;
}

int Player::dealdamage( double dmg, Result result, Weapon& weapon, Spell* spell )
{
    if ( result != RESULT_MISS && result != RESULT_DODGE )
    {
        dmg *= stats.dmgmod;
        dmg *= 1.0 - armorReduction;
        addRage( dmg, result, weapon, spell );
        return int( dmg );
    }
    else
    {
        addRage( dmg, result, weapon, spell );
        return 0;
    }
}

void Player::proccrit()
{
    if ( auras.has<Flurry>() ) auras.get<Flurry>().use();
    if ( auras.has<DeepWounds>() ) auras.get<DeepWounds>().use();
}

int Player::procattack( Spell* spell, Weapon& weapon, Result result )
{
    int procdmg = 0;
    if ( result != RESULT_MISS && result != RESULT_DODGE )
    {
        if ( weapon.proc1 && rng10k() < weapon.proc1->chance )
        {
            if ( weapon.proc1->spell ) weapon.proc1->spell->use();
            if ( weapon.proc1->magicdmg ) procdmg += magicproc( *weapon.proc1 );
            if ( weapon.proc1->physdmg ) procdmg += physproc( weapon.proc1->physdmg );
            if ( weapon.proc1->extra ) extraattacks += weapon.proc1->extra;
        }
        if ( weapon.proc2 && rng10k() < weapon.proc2->chance )
        {
            if ( weapon.proc2->spell ) weapon.proc2->spell->use();
            if ( weapon.proc2->magicdmg ) procdmg += magicproc( *weapon.proc2 );
        }
        if ( weapon.windfury && weapon.windfury->timer == 0 && rng10k() < 2000 )
        {
            weapon.windfury->use();
        }
        for ( auto& proc : attackproc )
        {
            if ( rng10k() < proc.chance )
            {
                if ( proc.extra ) batchedextras += proc.extra;
                if ( proc.magicdmg ) procdmg += magicproc( proc );
                if ( proc.spell ) proc.spell->use();
            }
        }
        if ( weapon.type == WEAPON_SWORD && talents.swordproc && rng10k() < talents.swordproc * 100 )
        {
            extraattacks += 1;
        }
        if ( auto* ptr = auras.ptr<Swarmguard>(); ptr && ptr->timer && rng10k() < ptr->chance )
        {
            ptr->proc();
        }
        if ( auto* ptr = auras.ptr<Zandalarian>(); ptr && ptr->timer )
        {
            ptr->proc();
        }
        if ( dragonbreath && rng10k() < 400 )
        {
            Proc breath;
            breath.magicdmg = 60;
            breath.coeff = 1;
            procdmg += magicproc( breath );
        }
    }
    if ( !spell || dynamic_cast<HeroicStrike*>( spell ) || dynamic_cast<HeroicStrikeExecute*>( spell ) )
    {
        if ( auto ptr = auras.ptr<Flurry>(); ptr && ptr->stacks )
        {
            ptr->proc();
        }
        if ( mh->windfury && mh->windfury->stacks )
        {
            mh->windfury->proc();
        }
    }
    return procdmg;
}

int Player::magicproc( Proc& proc )
{
    double mod = 1.0;
    int miss = 1700;
    int dmg = proc.magicdmg;
    //if ( proc.gcd && timer && timer < 1500 ) return 0;
    if ( proc.binaryspell ) miss = target.binaryresist;
    else mod *= target.mitigation;
    if ( rng10k() < miss ) return 0;
    if ( rng10k() < stats.spellcrit * 100 ) mod *= 1.5;
    if ( proc.coeff ) dmg += spelldamage;
    return int( ( double )dmg * mod );
}

int Player::physproc( int dmg )
{
    int roll = rng10k();
    roll -= std::max( mh->miss, 0 );
    if ( roll < 0 ) return 0;
    roll -= mh->dodge;
    if ( roll < 0 )
    {
        dodgetimer = 5000;
        dmg = 0;
    }
    roll = rng10k();
    if ( roll < crit + mh->crit * 100 ) dmg *= 2;
    return int( ( double )dmg * stats.dmgmod * mh->modifier );
}
