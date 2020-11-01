#pragma once
#include "common.h"

struct Buff
{
    int id;

    struct
    {
        int str;
        int agi;
        int ap;
        int crit;
        int hit;
        int spellcrit;
        int agimod;
        int strmod;
        int dmgmod;
        int haste;
        int bonusdmg;
    } stats;

    bool active = false;
};

extern static_vector<Buff> Buffs;
