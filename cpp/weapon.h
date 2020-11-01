#pragma once
#include "common.h"
#include <optional>

struct Windfury;

struct Weapon
{
    Player& player;
    int mindmg;
    int maxdmg;
    WeaponType type;
    double modifier;
    double speed;
    int timer = 0;
    double normSpeed = 2.4;
    bool offhand;
    bool twohand;
    int crit;
    int basebonusdmg;
    int bonusdmg;
    uint64_t totaldmg;
    uint64_t totalprocdmg;

    int glanceChance = 0;
    int miss = 0;
    int dwmiss = 0;
    int dodge = 0;

    int data[5] = { 0, 0, 0, 0, 0 };

    std::optional<Proc> proc1;
    std::optional<Proc> proc2;
    Windfury* windfury = nullptr;

    Weapon( Player& player_, Item& item, Enchant* enchant, Enchant* tempenchant, bool offhand_, bool twohand_ );

    double dmg( int bonus = 0 ) const;
    double avgdmg() const;
    void use();
    void step( int next )
    {
        timer -= next;
    }
};
