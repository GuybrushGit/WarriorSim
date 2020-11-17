#pragma once
#include "common.h"

struct Item
{
    int id;

    struct
    {
        int sta;
        int str;
        int agi;
        int ap;
        int crit;
        int hit;
        int ac;
        int defense;
        int dodge;
        int parry;
        int skill[NUM_WEAPON_TYPES];
    } stats;

    struct
    {
        int type;
        int mindmg;
        int maxdmg;
        double speed;
    } weapon;

    struct
    {
        int chance;
        double ppm;
        int extra;
        int magicdmg;
        int physdmg;
        int binaryspell;
        int gcd;
        int coeff;
        Aura&( *spell )( Player& player );
    } proc;

    bool selected = false;
};

struct Enchant
{
    int id;
    int temp;

    struct
    {
        int str;
        int agi;
        int ap;
        int crit;
        int haste;
        int bonusdmg;
    } stats;

    struct
    {
        double ppm;
        int magicdmg;
        Aura&( *spell )( Player& player );
    } proc;

    bool selected = false;
};

struct ItemSet
{
    int items[8];
    struct
    {
        int count;
        struct
        {
            int ap;
            int hit;
            int crit;
            int skill_1;
            int dmgmod;
            int enhancedbs;
        } stats;
        struct
        {
            int chance;
            Aura&( *spell )( Player& player );
        } proc;
    } bonuses[2];
};

extern static_vector<Item> Items[NUM_ITEM_SLOTS];
extern static_vector<Enchant> Enchants[NUM_ITEM_SLOTS];
extern static_vector<ItemSet> Sets;
