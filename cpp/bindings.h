#pragma once
#include "common.h"

void updateReport( int iteration, int maxiterations, uint64_t totaldmg, uint64_t totalduration );
void finalReport( int iterations, uint64_t totaldmg, uint64_t totalduration, double mindps, double maxdps, double sumdps, double sumdps2 );
void reportSpell( Spell& spell, int iterations, uint64_t totalduration );
void reportAura( Aura& aura, int iterations, uint64_t totalduration );
void reportWeapon( bool offhand, Weapon& weapon, int iterations, uint64_t totalduration );
void reportSpread( int* count, int size );

extern "C"
{
    void initRandom( int a, int b, int c, int d, int e, int f, int g, int h );

    Config* allocConfig();
    void freeConfig( Config* );

    Talents* allocTalents();
    void freeTalents( Talents* );
    void setTalent( Talents*, int id, int value );

    int* spellOptions( int id );

    void enableBuff( int id, int enabled );
    void enableItem( int type, int id, int enabled );
    void enableEnchant( int type, int id, int enabled );

    Simulation* allocSimulation( Config*, Talents* );
    void freeSimulation( Simulation* );
    void runSimulation( Simulation* );
    void reportSimulation( Simulation*, int full );
}
