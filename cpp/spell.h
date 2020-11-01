#pragma once
#include "common.h"

struct Castable
{
    virtual const char* name() const = 0;

    Player& player;
    int timer = 0;
    int maxdelay = 100;
    bool useonly = false;

    Castable( Player& player_ ) : player( player_ ) {}

    virtual void use() = 0;
    virtual bool canUse() const = 0;
};

struct Spell : public Castable
{
    int cost = 0;
    int cooldown = 0;
    bool refund = true;
    bool canDodge = true;
    uint64_t totaldmg = 0;
    int data[5] = { 0, 0, 0, 0, 0 };
    bool weaponspell = true;
    bool nocrit = false;
    int stacks = 0;

    Spell( Player& player_ ) : Castable( player_ ) {}

    virtual double dmg() const
    {
        return 0;
    }

    virtual void use() override;
    virtual bool canUse() const override;

    virtual int step( int a )
    {
        timer = std::max( timer - a, 0 );
        return timer;
    }
};

struct Bloodthirst : public Spell
{
    const char* name() const override
    {
        return "Bloodthirst";
    }

    static struct
    {
        int active = true;
        int minrage = 30;
        int reaction = 100;
    } options;

    Bloodthirst( Player& player_ )
        : Spell( player_ )
    {
        cost = 30;
        cooldown = 6;
        maxdelay = options.reaction;
        weaponspell = false;
    }

    double dmg() const override;
    bool canUse() const override;
};

struct MortalStrike : public Spell
{
    const char* name() const override
    {
        return "Mortal Strike";
    }

    static struct
    {
        int active = true;
        int minrage = 30;
        int reaction = 100;
    } options;

    MortalStrike( Player& player_ )
        : Spell( player_ )
    {
        cost = 30;
        cooldown = 6;
        maxdelay = options.reaction;
    }

    double dmg() const override;
    bool canUse() const override;
};

struct Whirlwind : public Spell
{
    const char* name() const override
    {
        return "Whirlwind";
    }

    static struct
    {
        int active = true;
        int minrage = 50;
        int maincd = 2;
        int reaction = 300;
    } options;

    Whirlwind( Player& player_ )
        : Spell( player_ )
    {
        cost = 25;
        cooldown = 10;
        refund = false;
        maxdelay = options.reaction;
    }

    double dmg() const override;
    bool canUse() const override;
};

struct Overpower : public Spell
{
    const char* name() const override
    {
        return "Overpower";
    }

    static struct
    {
        int active = true;
        int maxrage = 25;
        int maincd = 2;
        int reaction = 300;
    } options;

    Overpower( Player& player_ )
        : Spell( player_ )
    {
        cost = 5;
        cooldown = 5;
        canDodge = false;
        maxdelay = options.reaction;
    }

    double dmg() const override;
    void use() override;
    bool canUse() const override;
};

struct Execute : public Spell
{
    const char* name() const override
    {
        return "Execute";
    }

    static struct
    {
        int active = true;
        int priorityap = 2000;
        int reaction = 100;
    } options;

    int usedrage = 0;
    Result result;

    Execute( Player& player_ );

    double dmg() const override;
    void use() override;
    int step( int a ) override;
    bool canUse() const override;
};

struct Bloodrage : public Spell
{
    const char* name() const override
    {
        return "Bloodrage";
    }

    static struct
    {
        int active = true;
        int reaction = 300;
        int maxrage = 80;
    } options;

    int rage;

    Bloodrage( Player& player_ );

    void use() override;
    bool canUse() const override;
};

struct HeroicStrike : public Spell
{
    const char* name() const override
    {
        return "Heroic Strike";
    }

    static struct
    {
        int active = true;
        int minrage = 40;
        int maincd = 4;
        int unqueue = 0;
        int unqueuetimer = 200;
        int reaction = 500;
    } options;

    int bonus;

    HeroicStrike( Player& player_ );

    void use() override;
    bool canUse() const override;
};

struct HeroicStrikeExecute : public Spell
{
    const char* name() const override
    {
        return "Heroic Strike (Execute Phase)";
    }

    static struct
    {
        int active = true;
        int minrage = 40;
        int unqueue = 0;
        int unqueuetimer = 200;
        int reaction = 100;
    } options;

    int bonus;

    HeroicStrikeExecute( Player& player_ );

    void use() override;
    bool canUse() const override;
};

struct SunderArmor : public Spell
{
    const char* name() const override
    {
        return "Sunder Armor";
    }

    static struct
    {
        int active = true;
        int globals = 1;
        int reaction = 300;
    } options;

    SunderArmor( Player& player_ );

    void use() override;
    bool canUse() const override;
};

struct Hamstring : public Spell
{
    const char* name() const override
    {
        return "Hamstring";
    }

    static struct
    {
        int active = true;
        int minrage = 50;
        int reaction = 100;
    } options;

    Hamstring( Player& player_ );

    double dmg() const override
    {
        return 45.0;
    }

    bool canUse() const override;
};

struct Aura : public Castable
{
    int starttimer = 0;
    bool firstuse = true;
    int duration = 0;
    int stacks = 0;
    uint64_t uptime = 0;

    void( Player::*updateFunc )( );

    struct
    {
        int str = 0;
        int ap = 0;
        int crit = 0;
        int hit = 0;
        int bonusdmg = 0;
    } stats;

    struct
    {
        int haste = 0;
        int dmgmod = 0;
        int apmod = 0;
    } mult_stats;

    Aura( Player& player_, void( Player::*updateFunc_ )( ) )
        : Castable( player_ )
        , updateFunc( updateFunc_ )
    {
        useonly = true;
    }

    Aura( Player& player_ );

    virtual void use() override;
    virtual int step();
    virtual void end();

    virtual bool canUse() const override
    {
        return true;
    }
};

struct HitAura : public Aura { HitAura( Player& player_ ); };
struct StrengthAura : public Aura { StrengthAura( Player& player_ ); };
struct HasteAura : public Aura { HasteAura( Player& player_ ); };
struct AttackPowerAura : public Aura { AttackPowerAura( Player& player_ ); };
struct DmgModAura : public Aura { DmgModAura( Player& player_ ); };
struct BonusDmgAura : public Aura { BonusDmgAura( Player& player_ ); };
struct ArmorReductionAura : public Aura { ArmorReductionAura( Player& player_ ); };

struct Recklessness : public Aura
{
    const char* name() const override
    {
        return "Recklessness";
    }

    static struct
    {
        int active = true;
        int timetoend = 16;
        int reaction = 300;
    } options;

    Recklessness( Player& player_ )
        : Aura( player_ )
    {
        duration = 15;
        stats.crit = 100;
        maxdelay = options.reaction;
    }

    void use() override;
    bool canUse() const override;
};

struct Flurry : public HasteAura
{
    const char* name() const override
    {
        return "Flurry";
    }

    Flurry( Player& player_ );

    void proc();
    void use() override;
};

struct DeepWounds : public Aura
{
    const char* name() const override
    {
        return "Deep Wounds";
    }

    uint64_t totaldmg = 0;
    int nexttick = 0;

    DeepWounds( Player& player_ )
        : Aura( player_ )
    {
        duration = 12;
    }

    void use() override;
    int step() override;
};

struct Crusader : public StrengthAura
{
    Crusader( Player& player_ )
        : StrengthAura( player_ )
    {
        duration = 15;
        stats.str = 100;
    }

    static int count( Player& player );
};

struct CrusaderMH : public Crusader
{
    const char* name() const override
    {
        return "Crusader (MH)";
    }

    CrusaderMH( Player& player_ ) : Crusader( player_ ) {}
};

struct CrusaderOH : public Crusader
{
    const char* name() const override
    {
        return "Crusader (OH)";
    }

    CrusaderOH( Player& player_ ) : Crusader( player_ ) {}
};

struct Cloudkeeper : public AttackPowerAura
{
    const char* name() const override
    {
        return "Cloudkeeper";
    }

    Cloudkeeper( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 30;
        stats.ap = 100;
    }

    void use() override;
    bool canUse() const override;
};

struct Felstriker : public HitAura
{
    Felstriker( Player& player_ )
        : HitAura( player_ )
    {
        duration = 3;
        stats.crit = 100;
        stats.hit = 100;
    }
};

struct FelstrikerMH : public Felstriker
{
    const char* name() const override
    {
        return "Felstriker (MH)";
    }

    FelstrikerMH( Player& player_ ) : Felstriker( player_ ) {}
};

struct FelstrikerOH : public Felstriker
{
    const char* name() const override
    {
        return "Felstriker (OH)";
    }

    FelstrikerOH( Player& player_ ) : Felstriker( player_ ) {}
};

struct DeathWish : public DmgModAura
{
    const char* name() const override
    {
        return "Death Wish";
    }

    static struct
    {
        int active = true;
        int timetoend = 31;
        int crusaders = 0;
        int reaction = 300;
    } options;

    DeathWish( Player& player_ )
        : DmgModAura( player_ )
    {
        duration = 30;
        mult_stats.dmgmod = 20;
        maxdelay = options.reaction;
    }

    void use() override;
    bool canUse() const override;
};

struct BattleStance : public Aura
{
    const char* name() const override
    {
        return "Battle Stance";
    }

    BattleStance( Player& player_ )
        : Aura( player_ )
    {
        duration = 2;
        stats.crit = -3;
    }

    int step() override;
};

struct MightyRagePotion : public StrengthAura
{
    const char* name() const override
    {
        return "Mighty Rage Potion";
    }

    static struct
    {
        int active = true;
        int timetoend = 21;
        int crusaders = 0;
        int reaction = 100;
    } options;

    MightyRagePotion( Player& player_ )
        : StrengthAura( player_ )
    {
        duration = 20;
        stats.str = 60;
        maxdelay = options.reaction;
    }

    void use() override;
    bool canUse() const override;
};

struct BloodFury : public Aura
{
    const char* name() const override
    {
        return "Blood Fury";
    }

    static struct
    {
        int active = true;
        int timetoend = 26;
        int reaction = 300;
    } options;

    BloodFury( Player& player_ )
        : Aura( player_ )
    {
        duration = 15;
        mult_stats.apmod = 25;
        maxdelay = options.reaction;
    }

    void use() override;
    bool canUse() const override;
};

struct Berserking : public HasteAura
{
    const char* name() const override
    {
        return "Berserking";
    }

    static struct
    {
        int active = true;
        int timetoend = 11;
        int haste = 30;
        int reaction = 300;
    } options;

    Berserking( Player& player_ )
        : HasteAura( player_ )
    {
        duration = 10;
        mult_stats.haste = options.haste;
        maxdelay = options.reaction;
    }

    void use() override;
    bool canUse() const override;
};

struct Empyrean : public HasteAura
{
    const char* name() const override
    {
        return "Empyrean Haste";
    }

    Empyrean( Player& player_ )
        : HasteAura( player_ )
    {
        duration = 10;
        mult_stats.haste = 20;
    }
};

struct Eskhandar : public HasteAura
{
    const char* name() const override
    {
        return "Eskhandar Haste";
    }

    Eskhandar( Player& player_ )
        : HasteAura( player_ )
    {
        duration = 5;
        mult_stats.haste = 30;
    }
};

struct Zeal : public BonusDmgAura
{
    const char* name() const override
    {
        return "Zeal";
    }

    Zeal( Player& player_ )
        : BonusDmgAura( player_ )
    {
        duration = 15;
        stats.bonusdmg = 10;
    }

    void use() override;
};

struct Annihilator : public ArmorReductionAura
{
    const char* name() const override
    {
        return "Annihilator";
    }

    int armor = 200;

    Annihilator( Player& player_ )
        : ArmorReductionAura( player_ )
    {
        duration = 45;
    }

    void use() override;
};

struct Rivenspike : public ArmorReductionAura
{
    int armor = 200;

    Rivenspike( Player& player_ )
        : ArmorReductionAura( player_ )
    {
        duration = 30;
    }

    void use() override
    {
        stacks = std::min( stacks + 1, 3 );
        Aura::use();
    }
};

struct RivenspikeMH : public Rivenspike
{
    const char* name() const override
    {
        return "Rivenspike (MH)";
    }

    RivenspikeMH( Player& player_ ) : Rivenspike( player_ ) {}
};

struct RivenspikeOH : public Rivenspike
{
    const char* name() const override
    {
        return "Rivenspike (OH)";
    }

    RivenspikeOH( Player& player_ ) : Rivenspike( player_ ) {}
};

struct Bonereaver : public ArmorReductionAura
{
    const char* name() const override
    {
        return "Bonereaver";
    }

    int armor = 700;

    Bonereaver( Player& player_ )
        : ArmorReductionAura( player_ )
    {
        duration = 10;
    }

    void use() override
    {
        stacks = std::min( stacks + 1, 3 );
        Aura::use();
    }
};

struct Destiny : public StrengthAura
{
    const char* name() const override
    {
        return "Destiny";
    }

    Destiny( Player& player_ )
        : StrengthAura( player_ )
    {
        duration = 10;
        stats.str = 200;
    }
};

struct Untamed : public StrengthAura
{
    const char* name() const override
    {
        return "The Untamed Blade";
    }

    Untamed( Player& player_ )
        : StrengthAura( player_ )
    {
        duration = 8;
        stats.str = 300;
    }
};

struct Pummeler : public HasteAura
{
    const char* name() const override
    {
        return "Manual Crowd Pummeler";
    }

    Pummeler( Player& player_ )
        : HasteAura( player_ )
    {
        duration = 30;
        mult_stats.haste = 50;
    }

    void use() override;
    bool canUse() const override;
};

struct Windfury : public Aura
{
    const char* name() const override
    {
        return "Windfury";
    }

    int mintime = 0;

    Windfury( Player& player_ )
        : Aura( player_ )
    {
        stats.ap = 315;
    }

    void use() override;
    int step() override;
    void proc();
};

struct Swarmguard : public Aura
{
    const char* name() const override
    {
        return "Swarmguard";
    }

    int armor = 200;
    int chance = 5000;
    int timetoend = 30000;

    Swarmguard( Player& player_ )
        : Aura( player_ )
    {
        duration = 30;
    }

    void use() override;
    int step() override;
    void proc();
    bool canUse() const override;
};

struct Flask : public StrengthAura
{
    const char* name() const override
    {
        return "Diamond Flask";
    }

    Flask( Player& player_ )
        : StrengthAura( player_ )
    {
        duration = 60;
        stats.str = 75;
    }

    void use() override;
    bool canUse() const override;
};

struct Slayer : public AttackPowerAura
{
    const char* name() const override
    {
        return "Slayer's Crest";
    }

    Slayer( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 20;
        stats.ap = 260;
    }

    void use() override;
    bool canUse() const override;
};

struct Spider : public HasteAura
{
    const char* name() const override
    {
        return "Kiss of the Spider";
    }

    Spider( Player& player_ )
        : HasteAura( player_ )
    {
        duration = 15;
        mult_stats.haste = 20;
    }

    void use() override;
    bool canUse() const override;
};

struct Earthstrike : public AttackPowerAura
{
    const char* name() const override
    {
        return "Earthstrike";
    }

    Earthstrike( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 20;
        stats.ap = 280;
    }

    void use() override;
    bool canUse() const override;
};

struct Gabbar : public AttackPowerAura
{
    const char* name() const override
    {
        return "Jom Gabbar";
    }

    Gabbar( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 20;
        stats.ap = 65;
    }

    void use() override;
    int step() override;
    bool canUse() const override;
};

struct PrimalBlessing : public AttackPowerAura
{
    const char* name() const override
    {
        return "Primal Blessing";
    }

    PrimalBlessing( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 12;
        stats.ap = 300;
    }
};

struct BloodrageAura : public Aura
{
    const char* name() const override
    {
        return "Bloodrage";
    }

    BloodrageAura( Player& player_ )
        : Aura( player_ )
    {
        duration = 10;
    }

    void use() override;
    int step() override;
};

struct Zandalarian : public BonusDmgAura
{
    const char* name() const override
    {
        return "Zandalarian";
    }

    Zandalarian( Player& player_ )
        : BonusDmgAura( player_ )
    {
        duration = 20;
        stats.bonusdmg = 40;
    }

    void use() override;
    bool canUse() const override;
    void proc();
};

struct Avenger : public AttackPowerAura
{
    Avenger( Player& player_ )
        : AttackPowerAura( player_ )
    {
        duration = 10;
        stats.ap = 200;
    }
};

struct AvengerMH : public Avenger
{
    const char* name() const override
    {
        return "Avenger (MH)";
    }

    AvengerMH( Player& player_ ) : Avenger( player_ ) {}
};

struct AvengerOH : public Avenger
{
    const char* name() const override
    {
        return "Avenger (OH)";
    }

    AvengerOH( Player& player_ ) : Avenger( player_ ) {}
};
