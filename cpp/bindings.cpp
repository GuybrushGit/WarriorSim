#include "bindings.h"
#include "spell.h"
#include "weapon.h"
#include "talents.h"
#include "buffs.h"
#include "items.h"
#include "simulation.h"

#ifdef USE_EMSCRIPTEN
#include <emscripten.h>
#else
#include <iostream>
#include <iomanip>
#define EMSCRIPTEN_KEEPALIVE
#endif

void updateReport( int iteration, int maxiterations, uint64_t totaldmg, uint64_t totalduration )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            postMessage( [0, $0, { iterations: $1, totaldmg : $2, totalduration : $3 }] );
        }), iteration, maxiterations, ( double )totaldmg, ( double )totalduration / 1000.0 );
#else
    std::cout << std::fixed << std::setprecision(2) << "Iteration: " << iteration << "/" << maxiterations << "; DPS: " << 1000.0 * ( double )totaldmg / ( double )totalduration << std::endl;
#endif
}

void finalReport( int iterations, uint64_t totaldmg, uint64_t totalduration, double mindps, double maxdps, double sumdps, double sumdps2 )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            var report = { iterations: $0, totaldmg: $1, totalduration: $2, mindps: $3, maxdps: $4, sumdps: $5, sumdps2: $6, starttime: SIM_START, endtime: SIM_END };
            if ( typeof SIM_PLAYER !== "undefined" ) report.player = SIM_PLAYER;
            if ( typeof SIM_SPREAD !== "undefined" ) report.spread = SIM_SPREAD;
            postMessage( [ 1, report ] );
        }), iterations, ( double )totaldmg, ( double )totalduration / 1000.0, mindps, maxdps, sumdps, sumdps2 );
#else
    std::cout << std::fixed << std::setprecision( 2 ) << "Completed " << iterations << " iterations. DPS: " << 1000.0 * ( double )totaldmg / ( double )totalduration << " (min: " << mindps << ", max: " << maxdps << ")" << std::endl;
#endif
}

#ifndef USE_EMSCRIPTEN
void showReport( const char* name, uint64_t totaldmg, int* data, int iterations, uint64_t totalduration )
{
    int count = data[0] + data[1] + data[2] + data[3] + data[4];
    std::cout << std::fixed << std::setprecision( 2 ) << name << ": " << 1000.0 * ( double )totaldmg / ( double )totalduration << " DPS" << std::endl;
    std::cout << std::fixed << std::setprecision( 2 ) << "    Uses: " << ( double )count / ( double )iterations << std::endl;
    if ( data[RESULT_HIT] ) std::cout << std::fixed << std::setprecision( 2 ) << "     Hit: " << 100.0 * ( double )data[RESULT_HIT] / ( double )count << "%" << std::endl;
    if ( data[RESULT_MISS] ) std::cout << std::fixed << std::setprecision( 2 ) << "    Miss: " << 100.0 * ( double )data[RESULT_MISS] / ( double )count << "%" << std::endl;
    if ( data[RESULT_DODGE] ) std::cout << std::fixed << std::setprecision( 2 ) << "   Dodge: " << 100.0 * ( double )data[RESULT_DODGE] / ( double )count << "%" << std::endl;
    if ( data[RESULT_CRIT] ) std::cout << std::fixed << std::setprecision( 2 ) << "    Crit: " << 100.0 * ( double )data[RESULT_CRIT] / ( double )count << "%" << std::endl;
    if ( data[RESULT_GLANCE] ) std::cout << std::fixed << std::setprecision( 2 ) << "  Glance: " << 100.0 * ( double )data[RESULT_GLANCE] / ( double )count << "%" << std::endl;
}
#endif

void reportSpell( Spell& spell, int iterations, uint64_t totalduration )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            var name = UTF8ToString( $0 );
            var data = $2 >> 2;
            SIM_PLAYER.spells[name.replace(/[^\\\\w]/g, "").toLowerCase()] = { name, totaldmg: $1, data: [ ...HEAP32.subarray( data, data + 5 ) ] };
        }), spell.name(), ( double )spell.totaldmg, spell.data );
#else
    if ( spell.totaldmg )
    {
        showReport( spell.name(), spell.totaldmg, spell.data, iterations, totalduration );
    }
#endif
}

void reportAura( Aura& aura, int iterations, uint64_t totalduration )
{
    auto* deepWounds = dynamic_cast<DeepWounds*>( &aura );
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            var name = UTF8ToString( $0 );
            var data = { name, uptime: $1 };
            if ( $2 ) data.totaldmg = $2;
            SIM_PLAYER.auras[name.replace(/[^\\\\w]/g, "").toLowerCase()] = data;
        }), aura.name(), ( double )aura.uptime, deepWounds ? ( double )deepWounds->totaldmg : 0.0 );
#else
    if ( aura.uptime )
    {
        std::cout << std::fixed << std::setprecision( 2 ) << aura.name() << ": " << 10.0 * ( double )aura.uptime / ( double )totalduration << "%" << std::endl;
        if ( deepWounds )
        {
            std::cout << std::fixed << std::setprecision( 2 ) << "  DPS: " << 1000.0 * ( double )deepWounds->totaldmg / ( double )totalduration << std::endl;
        }
    }
#endif
}

void reportWeapon( bool offhand, Weapon& weapon, int iterations, uint64_t totalduration )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            var data = $3 >> 2;
            SIM_PLAYER[$0 ? "oh" : "mh"] = { totaldmg: $1, totalprocdmg: $2, data: [ ...HEAP32.subarray( data, data + 5 ) ] };
        }), offhand ? 1 : 0, ( double )weapon.totaldmg, ( double )weapon.totalprocdmg, weapon.data );
#else
    showReport( offhand ? "Off Hand" : "Main Hand", weapon.totaldmg, weapon.data, iterations, totalduration );
    if ( weapon.totalprocdmg )
    {
        std::cout << std::fixed << std::setprecision( 2 ) << ( offhand ? "Off Hand Proc" : "Main Hand Proc" ) << ": " << 1000.0 * ( double )weapon.totalprocdmg / ( double )totalduration << " DPS" << std::endl;
    }
#endif
}

void reportSpread( int* count, int size )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM(
        ({
            var start = ( $0 >> 2 ), end = ( $0 >> 2 ) + $1;
            SIM_SPREAD = {};
            for ( var i = start; i < end; ++i )
            {
                if ( HEAP32[i] )
                {
                    SIM_SPREAD[i - start] = HEAP32[i];
                }
            }
        }), count, size );
#endif
}

EMSCRIPTEN_KEEPALIVE
void initRandom( int a, int b, int c, int d, int e, int f, int g, int h )
{
    uint64_t x = ( uint64_t( a ) << 48 ) + ( uint64_t( b ) << 32 ) + ( uint64_t( c ) << 16 ) + uint64_t( d );
    uint64_t y = ( uint64_t( e ) << 48 ) + ( uint64_t( f ) << 32 ) + ( uint64_t( g ) << 16 ) + uint64_t( h );
    seedrng( x, y );
}

EMSCRIPTEN_KEEPALIVE
Config* allocConfig()
{
    return new Config;
}

EMSCRIPTEN_KEEPALIVE
void freeConfig( Config* cfg )
{
    delete cfg;
}

EMSCRIPTEN_KEEPALIVE
Talents* allocTalents()
{
    return new Talents;
}

EMSCRIPTEN_KEEPALIVE
void freeTalents( Talents* talents )
{
    delete talents;
}

EMSCRIPTEN_KEEPALIVE
void setTalent( Talents* talents, int id, int value )
{
    talents->add( id, value );
}

EMSCRIPTEN_KEEPALIVE
int* spellOptions( int id )
{
    switch ( id )
    {
    case 23894: return reinterpret_cast<int*>( &Bloodthirst::options );
    case 27580: return reinterpret_cast<int*>( &MortalStrike::options );
    case 11567: return reinterpret_cast<int*>( &HeroicStrike::options );
    case 20662: return reinterpret_cast<int*>( &Execute::options );
    case 1680: return reinterpret_cast<int*>( &Whirlwind::options );
    case 12328: return reinterpret_cast<int*>( &DeathWish::options );
    case 1719: return reinterpret_cast<int*>( &Recklessness::options );
    case 11585: return reinterpret_cast<int*>( &Overpower::options );
    case 26296: return reinterpret_cast<int*>( &Berserking::options );
    case 20572: return reinterpret_cast<int*>( &BloodFury::options );
    case 2687: return reinterpret_cast<int*>( &Bloodrage::options );
    case 17528: return reinterpret_cast<int*>( &MightyRagePotion::options );
    case 11597: return reinterpret_cast<int*>( &SunderArmor::options );
    case 7373: return reinterpret_cast<int*>( &Hamstring::options );
    case 115671: return reinterpret_cast<int*>( &HeroicStrikeExecute::options );
    default: return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
void enableBuff( int id, int enabled )
{
    for ( auto& buff : Buffs )
    {
        if ( buff.id == id )
        {
            buff.active = enabled;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void enableItem( int type, int id, int enabled )
{
    for ( auto& item : Items[type] )
    {
        if ( item.id == id )
        {
            item.selected = enabled;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void enableEnchant( int type, int id, int enabled )
{
    for ( auto& enchant : Enchants[type] )
    {
        if ( enchant.id == id )
        {
            enchant.selected = enabled;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
Simulation* allocSimulation( Config* config, Talents* talents )
{
    return new Simulation( *config, *talents );
}

EMSCRIPTEN_KEEPALIVE
void freeSimulation( Simulation* sim )
{
    delete sim;
}

EMSCRIPTEN_KEEPALIVE
void runSimulation( Simulation* sim )
{
#ifdef USE_EMSCRIPTEN
    EM_ASM( SIM_START = new Date().getTime() );
#endif
    sim->runAll();
#ifdef USE_EMSCRIPTEN
    EM_ASM( SIM_END = new Date().getTime() );
#endif
}

EMSCRIPTEN_KEEPALIVE
void reportSimulation( Simulation* sim, int full )
{
#ifdef USE_EMSCRIPTEN
    if ( full )
    {
        EM_ASM(( SIM_PLAYER = { auras: {}, spells: {} } ));
    }
#endif
    sim->report( full != 0 );
}
