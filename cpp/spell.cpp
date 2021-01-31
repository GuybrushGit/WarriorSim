#include "spell.h"
#include "player.h"
#include "simulation.h"
#include "talents.h"

static bool testMainCd( Player& player, int maincd )
{
    return ( player.spells.has<Bloodthirst>() && player.spells.get<Bloodthirst>().timer >= maincd * 1000 ) ||
           ( player.spells.has<MortalStrike>() && player.spells.get<MortalStrike>().timer >= maincd * 1000 );
}

// Spell

void Spell::use()
{
    player.timer = 1500;
    player.rage -= cost;
    timer = cooldown * 1000;
}

bool Spell::canUse() const
{
    return timer == 0 && cost <= player.rage;
}

// Bloodthirst
decltype( Bloodthirst::options ) Bloodthirst::options;

double Bloodthirst::dmg() const
{
    return double( player.stats.ap ) * 0.45;
}

bool Bloodthirst::canUse() const
{
    return Spell::canUse() && player.timer == 0 && player.rage >= options.minrage;
}

// Mortal Strike
decltype( MortalStrike::options ) MortalStrike::options;

double MortalStrike::dmg() const
{
    double dmg = ( player.weaponrng ? ( double )rng( player.mh->mindmg, player.mh->maxdmg ) : double( player.mh->mindmg + player.mh->maxdmg ) / 2.0 );
    return dmg + 160.0 + double( player.mh->bonusdmg ) + ( ( double )player.stats.ap / 14.0 ) * player.mh->normSpeed;
}

bool MortalStrike::canUse() const
{
    return Spell::canUse() && player.timer == 0 && player.rage >= options.minrage;
}

// Whirlwind
decltype( Whirlwind::options ) Whirlwind::options;

double Whirlwind::dmg() const
{
    double dmg = ( player.weaponrng ? ( double )rng( player.mh->mindmg, player.mh->maxdmg ) : double( player.mh->mindmg + player.mh->maxdmg ) / 2.0 );
    return dmg + double( player.mh->bonusdmg ) + ( ( double )player.stats.ap / 14.0 ) * player.mh->normSpeed;
}

bool Whirlwind::canUse() const
{
    return Spell::canUse() && player.timer == 0 && ( player.rage >= options.minrage || testMainCd( player, options.maincd ) );
}

// Overpower
decltype( Overpower::options ) Overpower::options;

double Overpower::dmg() const
{
    double dmg = ( player.weaponrng ? ( double )rng( player.mh->mindmg, player.mh->maxdmg ) : double( player.mh->mindmg + player.mh->maxdmg ) / 2.0 );
    return dmg + 35.0 + double( player.mh->bonusdmg ) + ( ( double )player.stats.ap / 14.0 ) * player.mh->normSpeed;
}

void Overpower::use()
{
    player.dodgetimer = 0;
    player.rage = std::min<double>( player.rage, player.talents.rageretained );
    Spell::use();
    if ( player.zerkstance )
    {
        player.auras.get<BattleStance>().use();
    }
}

bool Overpower::canUse() const
{
    return Spell::canUse() && player.timer == 0 && player.dodgetimer && player.rage <= options.maxrage && testMainCd( player, options.maincd );
}

// Execute
decltype( Execute::options ) Execute::options;

Execute::Execute( Player& player_ )
    : Spell( player_ )
{
    cost = 15 - player.talents.executecost;
    maxdelay = options.reaction;
    refund = false;
    weaponspell = false;
}

double Execute::dmg() const
{
    return 600 + 15 * usedrage;
}

void Execute::use()
{
    Spell::use();
    usedrage = int( player.rage );
    timer = player.simulation.batching - ( player.simulation.step % player.simulation.batching );
}

int Execute::step( int a )
{
    if ( timer <= a && result != RESULT_MISS && result != RESULT_DODGE )
    {
        player.rage = 0;
    }
    return Spell::step( a );
}

bool Execute::canUse() const
{
    return player.timer == 0 && cost <= player.rage;
}

// Bloodrage
decltype( Bloodrage::options ) Bloodrage::options;

Bloodrage::Bloodrage( Player& player_ )
    : Spell( player_ )
{
    rage = 10 + player.talents.bloodragebonus;
    cooldown = 60;
    useonly = true;
    maxdelay = options.reaction;
}

void Bloodrage::use()
{
    timer = cooldown * 1000;
    player.rage = std::min( player.rage + rage, 100.0 );
    player.auras.get<BloodrageAura>().use();
}

bool Bloodrage::canUse() const
{
    return timer == 0 && player.rage <= options.maxrage;
}

// Heroic Strike
decltype( HeroicStrike::options ) HeroicStrike::options;

HeroicStrike::HeroicStrike( Player& player_ )
    : Spell( player_ )
{
    cost = 15 - player.talents.impheroicstrike;
    bonus = player.aqbooks ? 175 : 138;
    useonly = true;
    maxdelay = options.reaction;
}

void HeroicStrike::use()
{
    player.nextswinghs = true;
}

bool HeroicStrike::canUse() const
{
    return !player.nextswinghs && cost <= player.rage && ( player.rage >= options.minrage || testMainCd( player, options.maincd ) ) &&
        ( !options.unqueue || player.mh->timer > options.unqueuetimer );
}

// Heroic Strike (Execute Phase)
decltype( HeroicStrikeExecute::options ) HeroicStrikeExecute::options;

HeroicStrikeExecute::HeroicStrikeExecute( Player& player_ )
    : Spell( player_ )
{
    cost = 15 - player.talents.impheroicstrike;
    bonus = player.aqbooks ? 175 : 138;
    useonly = true;
    maxdelay = options.reaction;
}

void HeroicStrikeExecute::use()
{
    player.nextswinghs = true;
}

bool HeroicStrikeExecute::canUse() const
{
    return !player.nextswinghs && cost <= player.rage && player.rage >= options.minrage &&
        ( !options.unqueue || player.mh->timer > options.unqueuetimer );
}

// Sunder Armor
decltype( SunderArmor::options ) SunderArmor::options;

SunderArmor::SunderArmor( Player& player_ )
    : Spell( player_ )
{
    cost = 15 - player.talents.impsunderarmor;
    nocrit = true;
    maxdelay = options.reaction;
}

void SunderArmor::use()
{
    Spell::use();
    stacks += 1;
}

bool SunderArmor::canUse() const
{
    return Spell::canUse() && stacks < options.globals;
}

// Hamstring
decltype( Hamstring::options ) Hamstring::options;

Hamstring::Hamstring( Player& player_ )
    : Spell( player_ )
{
    cost = 10;
    maxdelay = options.reaction;
    if ( includes( player.items, 16484 ) )
    {
        cost -= 3;
    }
    if ( includes( player.items, 19577 ) )
    {
        cost -= 2;
    }
}

bool Hamstring::canUse() const
{
    return Spell::canUse() && player.rage >= options.minrage;
}

// Aura

Aura::Aura( Player& player_ )
    : Aura( player_, &Player::updateAuras )
{
}

void Aura::use()
{
    if ( timer )
    {
        uptime += player.simulation.step - starttimer;
    }
    timer = player.simulation.step + duration * 1000;
    starttimer = player.simulation.step;
    ( player.*updateFunc )( );
}

int Aura::step()
{
    if ( player.simulation.step >= timer )
    {
        uptime += timer - starttimer;
        timer = 0;
        firstuse = false;
        ( player.*updateFunc )( );
    }
    return timer;
}

void Aura::end()
{
    uptime += player.simulation.step - starttimer;
    timer = 0;
    stacks = 0;
}

HitAura::HitAura( Player& player_ ) : Aura( player_, &Player::update ) {}
StrengthAura::StrengthAura( Player& player_ ) : Aura( player_, &Player::updateStrength ) {}
HasteAura::HasteAura( Player& player_ ) : Aura( player_, &Player::updateHaste ) {}
AttackPowerAura::AttackPowerAura( Player& player_ ) : Aura( player_, &Player::updateAP ) {}
DmgModAura::DmgModAura( Player& player_ ) : Aura( player_, &Player::updateDmgMod ) {}
BonusDmgAura::BonusDmgAura( Player& player_ ) : Aura( player_, &Player::updateBonusDmg ) {}
ArmorReductionAura::ArmorReductionAura( Player& player_ ) : Aura( player_, &Player::updateArmorReduction ) {}

// Recklessness
decltype( Recklessness::options ) Recklessness::options;

void Recklessness::use()
{
    player.timer = 1500;
    Aura::use();
}

bool Recklessness::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.simulation.step >= player.simulation.maxsteps - options.timetoend * 1000;
}

// Flurry

Flurry::Flurry( Player& player_ )
    : HasteAura( player_ )
{
    duration = 12;
    mult_stats.haste = player.talents.flurry;
}

void Flurry::proc()
{
    stacks -= 1;
    if ( !stacks )
    {
        uptime += player.simulation.step - starttimer;
        timer = 0;
        player.updateHaste();
    }
}

void Flurry::use()
{
    timer = 1;
    if ( !stacks )
    {
        starttimer = player.simulation.step;
        player.updateHaste();
    }
    stacks = 3;
}

// Deep Wounds

void DeepWounds::use()
{
    if ( timer )
    {
        uptime += player.simulation.step - starttimer;
    }
    nexttick = player.simulation.step + 3000;
    timer = player.simulation.step + duration * 1000;
    starttimer = player.simulation.step;
}

int DeepWounds::step()
{
    while ( player.simulation.step >= nexttick )
    {
        double dmg = double( player.mh->mindmg + player.mh->maxdmg ) / 2.0 + ( double )player.mh->bonusdmg + ( ( double )player.stats.ap / 14.0 ) * player.mh->speed;
        int idmg = int( dmg * player.mh->modifier * player.stats.dmgmod * player.talents.deepwounds / 4.0 );
        //std::cout << player.simulation.step << " " << name() << ": " << idmg << std::endl;
        player.simulation.idmg += idmg;
        totaldmg += idmg;

        nexttick += 3000;
    }
    if ( player.simulation.step >= timer )
    {
        uptime += timer - starttimer;
        timer = 0;
        firstuse = false;
    }
    return timer;
}

// Crusader

int Crusader::count( Player& player )
{
    int result = 0;
    if ( player.auras.has<CrusaderMH>() && player.auras.get<CrusaderMH>().timer )
    {
        result += 1;
    }
    if ( player.auras.has<CrusaderOH>() && player.auras.get<CrusaderOH>().timer )
    {
        result += 1;
    }
    return result;
}

// Cloudkeeper

void Cloudkeeper::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

bool Cloudkeeper::canUse() const
{
    return firstuse && player.itemtimer == 0 && timer == 0 && player.timer == 0;
}

// Death Wish
decltype( DeathWish::options ) DeathWish::options;

void DeathWish::use()
{
    player.rage -= 10;
    player.timer = 1500;
    Aura::use();
}

bool DeathWish::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.rage >= 10 &&(
        player.simulation.step >= player.simulation.maxsteps - options.timetoend * 1000 ||
        ( options.crusaders && Crusader::count( player ) >= options.crusaders ) );
}

// Battle Stance

int BattleStance::step()
{
    if ( player.simulation.step >= timer )
    {
        player.rage = std::min<double>( player.rage, player.talents.rageretained );
    }
    return Aura::step();
}

// Mighty Rage Potion
decltype( MightyRagePotion::options ) MightyRagePotion::options;

void MightyRagePotion::use()
{
    player.rage = std::min( player.rage + rng( 45, 75 ), 100.0 );
    Aura::use();
}

bool MightyRagePotion::canUse() const
{
    return firstuse && timer == 0 && ( player.simulation.step >= player.simulation.maxsteps - options.timetoend * 1000 ||
        ( options.crusaders && Crusader::count( player ) >= options.crusaders ) );
}

// Blood Fury
decltype( BloodFury::options ) BloodFury::options;

void BloodFury::use()
{
    player.timer = 1500;
    Aura::use();
}

bool BloodFury::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.simulation.step >= player.simulation.maxsteps - options.timetoend * 1000;
}

// Berserking
decltype( Berserking::options ) Berserking::options;

void Berserking::use()
{
    player.rage -= 5;
    player.timer = 1500;
    Aura::use();
}

bool Berserking::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.rage >= 5 && player.simulation.step >= player.simulation.maxsteps - options.timetoend * 1000;
}

// Zeal

void Zeal::use()
{
    if ( !player.timer || player.timer >= 1500 )
    {
        Aura::use();
    }
}

// Annihilator

void Annihilator::use()
{
    if ( rng10k() >= player.target.binaryresist )
    {
        stacks = std::min( stacks + 1, 3 );
        Aura::use();
    }
}

// Manual Crowd Pummeler

void Pummeler::use()
{
    player.timer = 1500;
    Aura::use();
}

bool Pummeler::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Windfury

void Windfury::use()
{
    if ( timer )
    {
        uptime += player.simulation.step - starttimer;
    }
    timer = player.simulation.step + 1500;
    starttimer = player.simulation.step;
    mintime = player.simulation.step % player.simulation.batching;
    stacks = 2;
    player.updateAP();
    player.extraattacks += 1;
}

int Windfury::step()
{
    if ( player.simulation.step >= timer )
    {
        uptime += timer - starttimer;
        timer = 0;
        stacks = 0;
        firstuse = false;
        player.updateAP();
    }
    return timer;
}

void Windfury::proc()
{
    if ( stacks < 2 )
    {
        if ( player.simulation.step < mintime )
        {
            timer = mintime;
        }
        else
        {
            step();
        }
        stacks = 0;
    }
    else
    {
        stacks -= 1;
    }
}

// Swarmguard

void Swarmguard::use()
{
    timer = player.simulation.step + duration * 1000;
    starttimer = player.simulation.step;
    stacks = 0;
}

int Swarmguard::step()
{
    if ( player.simulation.step >= timer )
    {
        uptime += timer - starttimer;
        timer = 0;
        stacks = 0;
        firstuse = false;
        player.updateArmorReduction();
    }
    return timer;
}

void Swarmguard::proc()
{
    stacks = std::min( stacks + 1, 6 );
    player.updateArmorReduction();
}

bool Swarmguard::canUse() const
{
    return firstuse && timer == 0 && player.simulation.step >= player.simulation.maxsteps - timetoend;
}

// Diamond Flask

void Flask::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

bool Flask::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Slayer's Crest

void Slayer::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

bool Slayer::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Kiss of the Spider

void Spider::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

bool Spider::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Earthstrike

void Earthstrike::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

bool Earthstrike::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Jom Gabbar

void Gabbar::use()
{
    stats.ap = 65;
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    Aura::use();
}

int Gabbar::step()
{
    if ( ( player.simulation.step - starttimer ) % 2000 == 0 )
    {
        stats.ap += 65;
        player.updateAP();
    }
    return Aura::step();
}

bool Gabbar::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

// Bloodrage

void BloodrageAura::use()
{
    if ( timer )
    {
        uptime += player.simulation.step - starttimer;
    }
    timer = player.simulation.step + duration * 1000;
    starttimer = player.simulation.step;
}

int BloodrageAura::step()
{
    if ( ( player.simulation.step - starttimer ) % 1000 == 0 )
    {
        player.rage = std::min( player.rage + 1.0, 100.0 );
    }
    if ( player.simulation.step >= timer )
    {
        uptime += timer - starttimer;
        timer = 0;
    }
    return timer;
}

// Zandalarian

void Zandalarian::use()
{
    player.timer = 1500;
    player.itemtimer = duration * 1000;
    stats.bonusdmg = 40;
    Aura::use();
}

bool Zandalarian::canUse() const
{
    return firstuse && timer == 0 && player.timer == 0 && player.itemtimer == 0;
}

void Zandalarian::proc()
{
    stats.bonusdmg -= 2;
    player.updateBonusDmg();
    if ( stats.bonusdmg <= 0 )
    {
        timer = player.simulation.step;
        step();
    }
}
