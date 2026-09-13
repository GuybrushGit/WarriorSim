#include "engine.hpp"

#include <algorithm>
#include <cmath>
#include <string>
#include <string_view>

namespace warriorsim {
namespace {

double value(const SpellState& spell, detail::KnownProperty key, double fallback = 0) {
    return spell.props.number(key, fallback);
}

bool option(const SpellState& spell, detail::KnownProperty key, bool fallback = false) {
    return spell.props.boolean(key, fallback);
}

bool active(const PlayerState& player, detail::KnownAction key) {
    const auto* aura = player.aura(key);
    return aura && aura->timer != 0;
}

void useAura(PlayerState& player, detail::KnownAction key) {
    if (auto* aura = player.aura(key)) auraUse(player, *aura);
}

double reactionDelay(PlayerState& player) {
    return player.rng.integer(player.props.number("reactionmin"_prop),
                              player.props.number("reactionmax"_prop));
}

bool mainCooldownReady(const PlayerState& player, const SpellState& spell) {
    const double maincd = value(spell, "maincd"_prop);
    if (!maincd) return true;
    const auto* bloodthirst = player.spell("bloodthirst"_action);
    const auto* mortalstrike = player.spell("mortalstrike"_action);
    return (bloodthirst && bloodthirst->timer >= maincd) ||
           (mortalstrike && mortalstrike->timer >= maincd);
}

bool rageReady(const PlayerState& player, const SpellState& spell) {
    return value(spell, "cost"_prop) <= player.rage && player.rage >= value(spell, "minrage"_prop);
}

std::string secondaryStance(const PlayerState& player) {
    const auto* might = player.spell("unstoppablemight"_action);
    return might ? might->props.string("secondarystance"_prop) : std::string{};
}

std::string stanceForGladExit(const PlayerState& player, std::string desired) {
    if (player.props.boolean("switchdelay"_prop) && player.stance == "glad") {
        const std::string base = player.props.string("basestance"_prop);
        return base == "glad" ? secondaryStance(player) : base;
    }
    return desired;
}

void useBase(PlayerState& player, SpellState& spell) {
    player.timer = 1500;
    player.rage -= value(spell, "cost"_prop);
    spell.timer = value(spell, "cooldown"_prop) * 1000;
    spell.maxdelay = reactionDelay(player);
}

void useWeapon(PlayerState& player, WeaponState& weapon) {
    weapon.timer = std::floor(weapon.speed * 1000.0 / player.stats.number("haste"_prop, 1) + .5);
    if (!weapon.offhand) {
        if (auto* slam = player.spell("slam"_action); slam && option(*slam, "afterswing"_prop)) {
            slam->props.set("mhthreshold"_prop, weapon.timer - 1000);
        }
    }
}

double normalizedWeaponDamage(PlayerState& player, const WeaponState& weapon,
                              double bonus = 0) {
    double damage = bonus + player.rng.integer(weapon.mindmg + weapon.bonusdmg,
                                               weapon.maxdmg + weapon.bonusdmg);
    damage += player.stats.number("ap"_prop) / 14.0 * weapon.normSpeed +
              player.stats.number("moddmgdone"_prop);
    return damage;
}

double weaponSpeedDamage(PlayerState& player, const WeaponState& weapon,
                         double bonus = 0) {
    double damage = bonus + player.rng.integer(weapon.mindmg + weapon.bonusdmg,
                                               weapon.maxdmg + weapon.bonusdmg);
    damage += player.stats.number("ap"_prop) / 14.0 * weapon.speed +
              player.stats.number("moddmgdone"_prop);
    return damage;
}

double fixedMagicProc(PlayerState& player, double magicDamage) {
    ProcState proc;
    proc.props.set("magicdmg"_prop, magicDamage);
    proc.loadScalars();
    return player.magicProc(proc);
}

bool queuedStrikeCanUse(PlayerState& player, SpellState& spell) {
    if (player.nextswinghs || value(spell, "cost"_prop) > player.rage) return false;
    const double minrage = value(spell, "minrage"_prop);
    const double maincd = value(spell, "maincd"_prop);
    if ((minrage || maincd) &&
        !(minrage && player.rage >= minrage) &&
        !(maincd && player.spell("bloodthirst"_action) &&
          player.spell("bloodthirst"_action)->timer >= maincd) &&
        !(maincd && player.spell("mortalstrike"_action) &&
          player.spell("mortalstrike"_action)->timer >= maincd)) return false;
    return !value(spell, "unqueue"_prop) || player.mh.timer > value(spell, "unqueuetimer"_prop);
}

bool standardMeleeCanUse(PlayerState& player, SpellState& spell) {
    return spell.timer == 0 && player.timer == 0 && rageReady(player, spell);
}

} // namespace

bool spellCanUse(PlayerState& player, SpellState& spell) {
    const double cost = value(spell, "cost"_prop);
    const double minrage = value(spell, "minrage"_prop);
    const double maxrage = value(spell, "maxrage"_prop);

    switch (spell.kind) {
    case SpellKind::Bloodthirst:
    case SpellKind::MortalStrike:
        return standardMeleeCanUse(player, spell);

    case SpellKind::Whirlwind:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            (player.isValidStance("zerk") || player.talents.number("rageretained"_prop) >= cost) &&
            (!maxrage || player.isValidStance("zerk") || player.rage <= maxrage) &&
            (!minrage || player.rage >= minrage) && mainCooldownReady(player, spell);

    case SpellKind::Overpower:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            player.dodgetimer != 0 &&
            (player.isValidStance("battle") || player.talents.number("rageretained"_prop) >= cost) &&
            (!maxrage || player.isValidStance("battle") || player.rage <= maxrage) &&
            mainCooldownReady(player, spell);

    case SpellKind::Execute:
        return player.timer == 0 && cost <= player.rage &&
            (!value(spell, "swingtimer"_prop) || player.mh.timer <= value(spell, "swingtimer"_prop)) &&
            (!minrage || player.rage >= minrage) &&
            (player.step >= spell.executestep || active(player, "suddendeath"_action));

    case SpellKind::Bloodrage:
        return spell.timer == 0 && player.step >= spell.useStep;

    case SpellKind::HeroicStrike:
    case SpellKind::Cleave:
        return queuedStrikeCanUse(player, spell);

    case SpellKind::SunderArmor:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            player.rage >= minrage && (!minrage || player.rage >= minrage) &&
            (!value(spell, "globals"_prop) || spell.stacks < value(spell, "globals"_prop));

    case SpellKind::Hamstring:
        return standardMeleeCanUse(player, spell);

    case SpellKind::Pummel:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            (!minrage || player.rage >= minrage) && mainCooldownReady(player, spell);

    case SpellKind::ThunderClap:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            (!minrage || player.rage >= minrage) &&
            (player.props.boolean("furiousthunder"_prop) || player.isValidStance("battle"));

    case SpellKind::VictoryRush:
        return player.timer == 0 && spell.stacks == 0;

    case SpellKind::RagingBlow:
        return spell.timer == 0 && player.timer == 0 && player.isEnraged();

    case SpellKind::MasterStrike:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            (!minrage || player.rage >= minrage) && mainCooldownReady(player, spell);

    case SpellKind::BerserkerRage:
        return spell.timer == 0 && player.timer == 0 &&
            (!maxrage || player.isValidStance("zerk") || player.rage <= maxrage);

    case SpellKind::QuickStrike:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
            ((!minrage && !value(spell, "maincd"_prop)) ||
             (minrage && player.rage >= minrage) ||
             (value(spell, "maincd"_prop) && player.spell("bloodthirst"_action) &&
              player.spell("bloodthirst"_action)->timer >= value(spell, "maincd"_prop)) ||
             (value(spell, "maincd"_prop) && player.spell("mortalstrike"_action) &&
              player.spell("mortalstrike"_action)->timer >= value(spell, "maincd"_prop)));

    case SpellKind::RagePotion:
        return spell.timer == 0 && player.rage < minrage && player.step >= spell.useStep;

    case SpellKind::Slam: {
        return spell.timer == 0 && player.timer == 0 &&
            player.mh.timer >= value(spell, "mhthreshold"_prop) &&
            (player.freeslam || cost <= player.rage) &&
            (!player.props.boolean("bloodsurge"_prop) || player.freeslam) &&
            (!minrage || player.rage >= minrage) && mainCooldownReady(player, spell);
    }

    case SpellKind::Fireball:
    case SpellKind::GunAxe:
        return spell.timer == 0 && player.step >= spell.useStep;

    case SpellKind::BlademasterFury:
        return spell.timer == 0 && player.timer == 0 &&
            (!player.spell("whirlwind"_action) || player.spell("whirlwind"_action)->timer > 0);

    case SpellKind::ShieldSlam:
        return player.props.boolean("shield"_prop) && spell.timer == 0 && player.timer == 0 &&
            (player.freeshieldslam || cost <= player.rage) &&
            (player.freeshieldslam || player.rage >= minrage) &&
            (!option(spell, "resolve"_prop) ||
             (player.aura("defendersresolve"_action) && !player.aura("defendersresolve"_action)->timer)) &&
            (!option(spell, "swordboard"_prop) || player.freeshieldslam);

    case SpellKind::Shockwave:
        return player.props.boolean("shield"_prop) && spell.timer == 0 && player.timer == 0 &&
            cost <= player.rage &&
            (player.isValidStance("def") || player.talents.number("rageretained"_prop) >= cost) &&
            (!maxrage || player.isValidStance("def") || player.rage <= maxrage) &&
            (!minrage || player.rage >= minrage) && mainCooldownReady(player, spell);

    case SpellKind::UnstoppableMight: {
        if (player.stancetimer || !player.aura("echoesbattle"_action)) return false;
        const std::string base = player.props.string("basestance"_prop);
        const std::string secondary = spell.props.string("secondarystance"_prop);
        const auto forecastRemaining = [&](const std::string& stance) {
            const auto key = detail::stanceForecastAction(stance);
            const std::string fallback = stance + "forecast";
            const auto* aura = key ? player.aura(*key) : player.aura(fallback);
            return aura ? aura->timer - player.step : 0.0;
        };
        const auto echoesRemaining = [&](const std::string& stance) {
            const auto key = detail::stanceEchoAction(stance);
            const std::string fallback = "echoes" + stance;
            const auto* aura = key ? player.aura(*key) : player.aura(fallback);
            return aura ? aura->timer - player.step : 0.0;
        };
        if (player.aura("battleforecast"_action) && option(spell, "switchtimeactive"_prop)) {
            if (player.stance == base && forecastRemaining(secondary) <= value(spell, "switchtime"_prop) &&
                player.rage <= value(spell, "switchrage"_prop)) {
                spell.props.setString("switchto"_prop, secondary);
                return true;
            }
            if (player.stance == secondary && forecastRemaining(base) <= value(spell, "switchtime"_prop) &&
                player.rage <= value(spell, "switchrage"_prop)) {
                spell.props.setString("switchto"_prop, base);
                return true;
            }
        }
        if (player.aura("battleforecast"_action) && option(spell, "switchoractive"_prop)) {
            if (player.stance == base &&
                (forecastRemaining(secondary) <= value(spell, "switchortime"_prop) ||
                 player.rage <= value(spell, "switchorrage"_prop))) {
                spell.props.setString("switchto"_prop, secondary);
                return true;
            }
            if (player.stance == secondary &&
                (forecastRemaining(base) <= value(spell, "switchortime"_prop) ||
                 player.rage <= value(spell, "switchorrage"_prop))) {
                spell.props.setString("switchto"_prop, base);
                return true;
            }
        }
        if (option(spell, "switchechoesactive"_prop)) {
            if (player.stance == base && echoesRemaining(secondary) <= value(spell, "switchechoestime"_prop) &&
                player.rage <= value(spell, "switchechoesrage"_prop)) {
                spell.props.setString("switchto"_prop, secondary);
                return true;
            }
            if (player.stance == secondary && echoesRemaining(base) <= value(spell, "switchechoestime"_prop) &&
                player.rage <= value(spell, "switchechoesrage"_prop)) {
                spell.props.setString("switchto"_prop, base);
                return true;
            }
        }
        if (option(spell, "switchdefault"_prop) && player.stance != base) {
            spell.props.setString("switchto"_prop, base);
            return true;
        }
        return false;
    }

    case SpellKind::StanceSwitch:
        return !player.spell("unstoppablemight"_action) && !player.stancetimer &&
               player.stance != player.props.string("basestance"_prop);

    case SpellKind::GrilekFury:
        return player.itemtimer == 0 && spell.timer == 0 && player.step >= spell.useStep;

    case SpellKind::Spell:
    case SpellKind::TheMoltenCore:
        return spell.timer == 0 && player.timer == 0 && cost <= player.rage &&
               player.rage >= minrage;
    }
    return false;
}

void spellUse(PlayerState& player, SpellState& spell, SpellState* delayedHeroic) {
    const double cost = value(spell, "cost"_prop);
    const double cooldown = value(spell, "cooldown"_prop);
    switch (spell.kind) {
    case SpellKind::Whirlwind:
        if (!player.isValidStance("zerk"))
            player.switchStance(stanceForGladExit(player, "zerk"));
        useBase(player, spell);
        return;

    case SpellKind::Overpower:
        if (!player.isValidStance("battle"))
            player.switchStance(stanceForGladExit(player, "battle"));
        player.timer = 1500;
        player.dodgetimer = 0;
        spell.timer = cooldown * 1000;
        spell.maxdelay = reactionDelay(player);
        player.rage -= cost;
        return;

    case SpellKind::Execute:
        if (!player.isValidStance("zerk") && !player.isValidStance("battle")) {
            std::string stance = "zerk";
            if (player.props.boolean("switchdelay"_prop) && player.stance == "glad")
                stance = stanceForGladExit(player, stance);
            else if (player.props.string("basestance"_prop) == "battle" || secondaryStance(player) == "battle")
                stance = "battle";
            player.switchStance(stance);
        }
        if (delayedHeroic && option(*delayedHeroic, "exmacro"_prop)) {
            if (spellCanUse(player, *delayedHeroic)) {
                player.cast(*delayedHeroic);
                player.heroicdelay = 0;
            } else if (delayedHeroic->kind == SpellKind::Cleave && delayedHeroic->backupHeroic &&
                       spellCanUse(player, *delayedHeroic->backupHeroic)) {
                player.cast(*delayedHeroic->backupHeroic);
                player.heroicdelay = 0;
            }
        }
        player.timer = 1500;
        player.rage -= cost;
        spell.usedrage = static_cast<std::int32_t>(player.rage);
        spell.totalusedrage += spell.usedrage - (active(player, "suddendeath"_action) ? 10 : 0);
        spell.timer = 1 - detail::jsRemainder(player.step, 1.0);
        spell.maxdelay = reactionDelay(player);
        return;

    case SpellKind::Bloodrage: {
        spell.timer = cooldown * 1000;
        const double oldRage = player.rage;
        player.rage = std::min(player.rage + value(spell, "rage"_prop), 100.0);
        useAura(player, "bloodrage"_action);
        spell.maxdelay = reactionDelay(player);
        if (player.turtleMode && player.talents.number("enrage"_prop))
            useAura(player, "enrage"_action);
        if (oldRage < 60 && player.rage >= 60) useAura(player, "consumedrage"_action);
        return;
    }

    case SpellKind::HeroicStrike:
    case SpellKind::Cleave:
        player.nextswinghs = true;
        spell.maxdelay = reactionDelay(player);
        spell.props.set("unqueuetimer"_prop, 300 + reactionDelay(player));
        return;

    case SpellKind::SunderArmor:
        player.timer = 1500;
        player.rage -= cost;
        spell.timer = cooldown * 1000;
        spell.stacks = std::min(6, spell.stacks + 1);
        if (player.props.boolean("homunculi"_prop) || player.props.boolean("exposed"_prop)) spell.stacks = 6;
        spell.maxdelay = reactionDelay(player);
        return;

    case SpellKind::Hamstring: {
        if (!player.isValidStance("zerk") && !player.isValidStance("battle")) {
            std::string stance = "zerk";
            if (player.props.string("basestance"_prop) == "battle" || secondaryStance(player) == "battle")
                stance = "battle";
            player.switchStance(stance);
        }
        player.timer = 1500;
        player.rage -= cost;
        spell.timer = cooldown * 1000;
        spell.maxdelay = reactionDelay(player);
        return;
    }

    case SpellKind::Pummel:
        if (!player.isValidStance("zerk") && !player.isValidStance("battle")) {
            std::string stance = "zerk";
            if (player.props.string("basestance"_prop) == "battle" || secondaryStance(player) == "battle")
                stance = "battle";
            player.switchStance(stance);
        }
        useBase(player, spell);
        return;

    case SpellKind::ThunderClap:
        if (!player.isValidStance("battle") && !player.props.boolean("furiousthunder"_prop))
            player.switchStance("battle");
        useBase(player, spell);
        return;

    case SpellKind::VictoryRush:
        ++spell.stacks;
        player.timer = 1500;
        player.rage -= cost;
        spell.maxdelay = reactionDelay(player);
        return;

    case SpellKind::MasterStrike:
        player.rage -= cost;
        player.timer = 1500;
        spell.timer = cooldown * 1000;
        return;

    case SpellKind::BerserkerRage: {
        player.timer = 1500;
        spell.timer = cooldown * 1000;
        const double oldRage = player.rage;
        if (!player.isValidStance("zerk")) player.switchStance("zerk");
        player.rage = std::min(player.rage + value(spell, "rage"_prop), 100.0);
        useAura(player, "berserkerrage"_action);
        spell.maxdelay = reactionDelay(player);
        if (oldRage < 60 && player.rage >= 60) useAura(player, "consumedrage"_action);
        return;
    }

    case SpellKind::RagePotion: {
        spell.timer = cooldown * 1000;
        const double oldRage = player.rage;
        player.rage = std::min(player.rage + static_cast<double>(player.rng.integer(
            value(spell, "value1"_prop), value(spell, "value2"_prop))), 100.0);
        spell.maxdelay = reactionDelay(player);
        if (oldRage < 60 && player.rage >= 60) useAura(player, "consumedrage"_action);
        return;
    }

    case SpellKind::Slam: {
        const bool free = player.freeslam;
        if (free) spell.offhandhit = true;
        if (!free) player.rage -= cost;
        spell.maxdelay = reactionDelay(player);
        if (value(spell, "casttime"_prop) && !free && !player.turtleMode) {
            useWeapon(player, player.mh);
            if (player.oh) useWeapon(player, *player.oh);
        }
        player.freeslam = false;
        spell.timer = cooldown * 1000;
        return;
    }

    case SpellKind::Fireball:
        spell.timer = 1;
        spell.idmg += fixedMagicProc(player, 371);
        return;

    case SpellKind::GunAxe:
        spell.timer = 1;
        spell.idmg += fixedMagicProc(player, 225);
        return;

    case SpellKind::BlademasterFury:
        player.timer = 1500;
        spell.timer = cooldown * 1000;
        spell.maxdelay = reactionDelay(player);
        if (auto* whirlwind = player.spell("whirlwind"_action)) whirlwind->timer = 0;
        return;

    case SpellKind::ShieldSlam:
        player.timer = 1500;
        if (!player.freeshieldslam) player.rage -= cost;
        spell.timer = cooldown * 1000;
        player.freeshieldslam = false;
        spell.maxdelay = reactionDelay(player);
        return;

    case SpellKind::Shockwave:
        if (!player.isValidStance("def")) player.switchStance("def");
        useBase(player, spell);
        return;

    case SpellKind::TheMoltenCore: {
        double procDamage = fixedMagicProc(player, 20);
        for (int i = 0; i < player.props.integer("adjacent"_prop); ++i)
            procDamage += fixedMagicProc(player, 20);
        spell.idmg += procDamage;
        return;
    }

    case SpellKind::UnstoppableMight:
        spell.maxdelay = reactionDelay(player);
        player.switchStance(spell.props.string("switchto"_prop));
        return;

    case SpellKind::StanceSwitch:
        spell.maxdelay = reactionDelay(player);
        player.switchStance(player.props.string("basestance"_prop));
        return;

    case SpellKind::GrilekFury: {
        player.itemtimer = cooldown * 1000;
        spell.timer = cooldown * 1000;
        spell.maxdelay = reactionDelay(player);
        const double oldRage = player.rage;
        player.rage = std::min(player.rage + value(spell, "rage"_prop), 100.0);
        if (oldRage < 60 && player.rage >= 60) useAura(player, "consumedrage"_action);
        return;
    }

    case SpellKind::Spell:
    case SpellKind::Bloodthirst:
    case SpellKind::MortalStrike:
    case SpellKind::RagingBlow:
    case SpellKind::QuickStrike:
        useBase(player, spell);
        return;
    }
}

double spellDamage(PlayerState& player, SpellState& spell, WeaponState* weapon) {
    const double dmgmod = player.stats.number("dmgmod"_prop, 1);
    switch (spell.kind) {
    case SpellKind::Bloodthirst: {
        const double damage = player.turtleMode ?
            200 + player.stats.number("ap"_prop) * .35 : player.stats.number("ap"_prop) * .45;
        return damage * dmgmod * player.mainspelldmg;
    }
    case SpellKind::Whirlwind:
        if (active(player, "consumedrage"_action)) spell.offhandhit = true;
        return normalizedWeaponDamage(player, player.mh) * dmgmod;
    case SpellKind::Overpower: {
        const double mod = player.props.boolean("heroicbonus"_prop) ? 1.25 : 1;
        return normalizedWeaponDamage(player, player.mh, value(spell, "value1"_prop)) * dmgmod * mod;
    }
    case SpellKind::Execute:
        return (value(spell, "value1"_prop) + value(spell, "value2"_prop) * spell.usedrage *
            value(spell, "dumpmod"_prop, 1)) * dmgmod;
    case SpellKind::MortalStrike:
        return normalizedWeaponDamage(player, player.mh, value(spell, "value1"_prop)) *
               dmgmod * player.mainspelldmg;
    case SpellKind::SunderArmor: {
        if (!option(spell, "devastate"_prop)) return 0;
        const double mod = 1.5 * (1 + .1 * (spell.stacks - 1));
        const double average = (player.mh.mindmg + player.mh.maxdmg) / 2.0;
        const double dps = (average + player.stats.number("ap"_prop) / 14.0 * player.mh.speed) /
                           player.mh.speed;
        return dps * mod * dmgmod;
    }
    case SpellKind::Hamstring:
        return value(spell, "value1"_prop) * dmgmod;
    case SpellKind::Pummel:
        return (20 + player.stats.number("ap"_prop) * .05) * dmgmod;
    case SpellKind::ThunderClap: {
        double damage = value(spell, "value1"_prop);
        if (player.sodMode)
            damage += static_cast<std::int32_t>(player.stats.number("ap"_prop) * .05);
        if (player.props.boolean("furiousthunder"_prop)) damage *= 2;
        return damage * dmgmod;
    }
    case SpellKind::VictoryRush:
        return player.stats.number("ap"_prop) * .45 * dmgmod;
    case SpellKind::RagingBlow:
        return normalizedWeaponDamage(player, player.mh) * dmgmod;
    case SpellKind::MasterStrike: {
        const WeaponState& use = weapon ? *weapon : player.mh;
        return weaponSpeedDamage(player, use) * dmgmod * .35;
    }
    case SpellKind::QuickStrike: {
        const double damage = player.rng.integer(player.stats.number("ap"_prop) * .25,
                                                 player.stats.number("ap"_prop) * .35) +
                              player.stats.number("moddmgdone"_prop);
        return damage * dmgmod * (player.props.boolean("heroicbonus"_prop) ? 1.25 : 1);
    }
    case SpellKind::Slam: {
        const WeaponState& use = weapon ? *weapon : player.mh;
        const double bonus = player.turtleMode ? 0 : value(spell, "value1"_prop);
        return weaponSpeedDamage(player, use, bonus) * dmgmod *
               (player.props.boolean("heroicbonus"_prop) ? 1.25 : 1);
    }
    case SpellKind::BlademasterFury:
        return normalizedWeaponDamage(player, player.mh) * dmgmod;
    case SpellKind::ShieldSlam: {
        double ap = player.stats.number("ap"_prop);
        if (auto* resolve = player.aura("defendersresolve"_action); resolve && !resolve->timer)
            ap += 4 * player.stats.number("defense"_prop);
        const double damage = player.rng.integer(value(spell, "value1"_prop), value(spell, "value2"_prop)) +
            player.stats.number("block"_prop) * 2 + static_cast<std::int32_t>(ap * .15);
        return damage * dmgmod * player.mainspelldmg;
    }
    case SpellKind::Shockwave:
        return player.stats.number("ap"_prop) / 2.0 * dmgmod;
    default:
        return 0;
    }
}

bool spellStep(PlayerState&, SpellState& spell, double amount) {
    if (spell.timer <= amount) spell.timer = 0;
    else spell.timer -= amount;
    return spell.timer != 0;
}

void spellPrep(PlayerState&, SpellState& spell, int duration) {
    switch (spell.kind) {
    case SpellKind::Bloodrage:
    case SpellKind::RagePotion:
    case SpellKind::Fireball:
    case SpellKind::GunAxe:
    case SpellKind::GrilekFury:
        if (spell.props.has("timetoend"_prop))
            spell.useStep = std::max(static_cast<double>(duration) - value(spell, "timetoend"_prop), 0.0);
        if (spell.props.has("timetostart"_prop)) spell.useStep = value(spell, "timetostart"_prop);
        return;
    default:
        return;
    }
}

} // namespace warriorsim

