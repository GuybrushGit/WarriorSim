#include "engine.hpp"

#include <algorithm>
#include <cmath>

namespace warriorsim {
namespace {

double durationMs(const AuraState& aura) { return aura.props.number("duration"_prop) * 1000.0; }
double cooldownMs(const AuraState& aura) { return aura.props.number("cooldown"_prop) * 1000.0; }
bool active(const AuraState& aura) { return aura.timer != 0; }

void accountRefresh(PlayerState& player, AuraState& aura) {
    if (active(aura)) aura.uptime += player.step - aura.starttimer;
}

void begin(PlayerState& player, AuraState& aura, int precounter = 0) {
    accountRefresh(player, aura);
    aura.timer = player.step + durationMs(aura) - precounter;
    aura.starttimer = player.step - precounter;
}

void setDelay(PlayerState& player, AuraState& aura) {
    aura.maxdelay = player.rng.integer(player.prop("reactionmin"_prop), player.prop("reactionmax"_prop));
}

void expire(PlayerState& player, AuraState& aura, bool firstuse = false) {
    aura.uptime += aura.timer - aura.starttimer;
    aura.timer = 0;
    if (firstuse) aura.firstuse = false;
}

void consumedRage(PlayerState& player, double oldRage) {
    if (oldRage < 60 && player.rage >= 60) {
        if (auto* consumed = player.aura("consumedrage"_action)) auraUse(player, *consumed);
    }
}

void useWithUpdate(PlayerState& player, AuraState& aura,
                   void (PlayerState::*update)(), int precounter = 0,
                   bool delay = false) {
    begin(player, aura, precounter);
    (player.*update)();
    if (delay) setDelay(player, aura);
}

bool stepWithUpdate(PlayerState& player, AuraState& aura,
                    void (PlayerState::*update)(), bool firstuse = false,
                    bool setCooldown = false) {
    if (player.step < aura.timer) return true;
    expire(player, aura, firstuse);
    if (setCooldown) aura.useStep = aura.starttimer + cooldownMs(aura);
    (player.*update)();
    return false;
}

void useItem(PlayerState& player, AuraState& aura, int precounter,
             void (PlayerState::*update)(), bool delay = false) {
    player.itemtimer = durationMs(aura) - precounter;
    useWithUpdate(player, aura, update, precounter, delay);
}

bool stepPeriodicDamage(PlayerState& player, AuraState& aura,
                        double interval, double damage) {
    while (player.step >= aura.nexttick) {
        aura.idmg += damage;
        aura.totaldmg += damage;
        aura.nexttick += interval;
    }
    if (player.step >= aura.timer) {
        expire(player, aura, true);
        return false;
    }
    return true;
}

bool isAlwaysBase(AuraKind kind) {
    switch (kind) {
    case AuraKind::Aura:
    case AuraKind::Destiny:
    case AuraKind::Untamed:
    case AuraKind::Champion:
    case AuraKind::ZandalariVigil:
    case AuraKind::ForgottenOrder:
    case AuraKind::ElementiumChampion:
    case AuraKind::TowerForgeSetBonus:
    case AuraKind::Avenger:
    case AuraKind::LordGeneral:
    case AuraKind::ZerkForecast:
    case AuraKind::DefForecast:
    case AuraKind::ObsidianStrength:
    case AuraKind::ObsidianHaste:
        return true;
    default:
        return false;
    }
}

} // namespace

bool auraCanUse(PlayerState& player, AuraState& aura) {
    const bool ready = !active(aura) && player.step >= aura.useStep;
    switch (aura.kind) {
    case AuraKind::Recklessness:
        return ready && !player.timer;
    case AuraKind::Cloudkeeper:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::DeathWish:
        return ready && !player.timer && player.rage >=
            (player.flag("altdreadnaughttwoset"_prop) ? 0 : 10);
    case AuraKind::MightyRagePotion:
    case AuraKind::QuicknessPotion:
    case AuraKind::Bloodlust:
    case AuraKind::VoidMadness:
    case AuraKind::MildlyIrradiated:
    case AuraKind::GyromaticAcceleration:
    case AuraKind::GneuroLogical:
    case AuraKind::CoinFlip:
        return aura.firstuse && ready;
    case AuraKind::Chastise:
        return ready;
    case AuraKind::BloodFury:
        return aura.firstuse && ready && !player.timer;
    case AuraKind::Berserking:
        return aura.firstuse && ready && player.rage >= 5;
    case AuraKind::Perception:
        return aura.firstuse && ready && player.timer;
    case AuraKind::Pummeler:
    case AuraKind::Flask:
    case AuraKind::DemonTaintedBlood:
    case AuraKind::MoonstalkerFury:
    case AuraKind::WrathWray:
    case AuraKind::GrilekGuard:
        return aura.firstuse && ready && !player.itemtimer &&
            (aura.kind != AuraKind::Flask || !player.timer);
    case AuraKind::Swarmguard:
        return aura.firstuse && ready;
    case AuraKind::Hategrips:
        return aura.firstuse && !active(aura) && !player.timer && !player.itemtimer;
    case AuraKind::Slayer:
    case AuraKind::RoarGuardian:
    case AuraKind::RelentlessStrength:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::WorgenMark:
        return aura.firstuse && !active(aura);
    case AuraKind::Spider:
    case AuraKind::Earthstrike:
    case AuraKind::Gabbar:
    case AuraKind::MoltenEmberstone:
    case AuraKind::Zandalarian:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::BattleShout:
        return !active(aura) && !player.timer && player.rage >= aura.props.number("cost"_prop);
    case AuraKind::Rend: {
        const double cost = aura.props.number("cost"_prop);
        const bool stance = player.isValidStance("battle", true) ||
            player.isValidStance("def", true);
        return !active(aura) && !player.timer && player.rage >= cost &&
            (stance || player.talents.number("rageretained"_prop) >= cost) &&
            (!aura.props.number("maxrage"_prop) || stance || player.rage <= aura.props.number("maxrage"_prop));
    }
    case AuraKind::Rampage:
        return ready && player.isEnraged();
    case AuraKind::JujuFlurry:
        return ready;
    default:
        return false;
    }
}

int auraPrep(PlayerState&, AuraState& aura, double duration, double itemdelay) {
    if (aura.props.has("timetostart"_prop)) aura.useStep = aura.props.integer("timetostart"_prop);
    if (!aura.props.has("timetoend"_prop)) return 0;

    const int timeToEnd = aura.props.integer("timetoend"_prop);
    const int auraDuration = static_cast<int>(durationMs(aura));
    if (aura.props.boolean("item"_prop) && !aura.props.boolean("noitemcd"_prop)) {
        aura.useStep = std::max(std::min(duration - timeToEnd,
            duration - itemdelay - auraDuration), 0.0);
        return auraDuration;
    }
    aura.useStep = std::max(duration - timeToEnd, 0.0);
    return 0;
}

void auraRemove(PlayerState& player, AuraState& aura) {
    if (!active(aura) && aura.kind != AuraKind::SuddenDeath) return;
    aura.uptime += player.step - aura.starttimer;
    aura.timer = 0;
    switch (aura.kind) {
    case AuraKind::SuddenDeath:
        break;
    default:
        player.updateAuras();
        break;
    }
}

void auraEnd(PlayerState& player, AuraState& aura) {
    if (aura.kind == AuraKind::Rend) {
        if (aura.stacks) aura.uptime += player.step - aura.starttimer;
    } else if (active(aura)) {
        aura.uptime += player.step - aura.starttimer;
    }
    aura.timer = 0;
    aura.stacks = 0;
    switch (aura.kind) {
    case AuraKind::Zeal:
    case AuraKind::BlisteringRagehammer:
    case AuraKind::Stoneslayer:
    case AuraKind::RelentlessStrength:
    case AuraKind::CrusaderZeal:
        player.updateBonusDmg();
        break;
    case AuraKind::Zandalarian:
        player.updateBonusDmg();
        break;
    case AuraKind::Rend:
        aura.tfbstep = -6000;
        player.updateDmgMod();
        break;
    case AuraKind::Spicy:
        player.updateHasteDamage();
        if (player.attackproc1 && player.attackproc1->props.boolean("spicy"_prop)) player.attackproc1.reset();
        if (player.attackproc2 && player.attackproc2->props.boolean("spicy"_prop)) player.attackproc2.reset();
        break;
    case AuraKind::JujuFlurry:
        player.updateHasteDamage();
        break;
    default:
        break;
    }
}

void auraUse(PlayerState& player, AuraState& aura, bool prepull, int precounter) {
    const auto basic = [&] {
        begin(player, aura);
        player.updateAuras();
        setDelay(player, aura);
    };
    if (isAlwaysBase(aura.kind)) {
        basic();
        return;
    }

    switch (aura.kind) {
    case AuraKind::TwowEnrageAura:
        useWithUpdate(player, aura, &PlayerState::updateDmgMod);
        break;
    case AuraKind::Recklessness:
        begin(player, aura);
        player.timer = 1500;
        if (!player.isValidStance("zerk")) player.switchStance("zerk");
        player.updateAuras();
        setDelay(player, aura);
        break;
    case AuraKind::Flurry:
        aura.timer = 1;
        if (!aura.stacks) {
            aura.starttimer = player.step;
            player.updateHaste();
        }
        aura.stacks = 3;
        break;
    case AuraKind::DeepWounds: {
        accountRefresh(player, aura);
        const WeaponState& weapon = prepull && player.oh ? *player.oh : player.mh;
        const double min = weapon.mindmg + weapon.bonusdmg +
            player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * weapon.speed;
        const double max = weapon.maxdmg + weapon.bonusdmg +
            player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * weapon.speed;
        aura.ticksleft = 4;
        aura.saveddmg += (min + max) / 2.0 * weapon.modifier *
            player.stats.number("dmgmod"_prop, 1) * player.talents.number("deepwounds"_prop) *
            player.prop("bleedmod"_prop, 1);
        if (!aura.nexttick) {
            aura.nexttick = player.step + 3000;
            aura.timer = player.step + durationMs(aura);
        } else {
            aura.timer = aura.nexttick - 3000 + durationMs(aura);
        }
        aura.starttimer = player.step;
        player.updateDmgMod();
        break;
    }
    case AuraKind::OldDeepWounds:
        accountRefresh(player, aura);
        aura.nexttick = player.step + 3000;
        aura.timer = player.step + durationMs(aura);
        aura.starttimer = player.step;
        break;
    case AuraKind::PotentVenoms:
        accountRefresh(player, aura);
        if (!aura.stacks) aura.nexttick = player.step + 3000;
        aura.stacks = std::min(aura.stacks + 1, 2);
        aura.timer = player.step + durationMs(aura);
        aura.starttimer = player.step;
        break;
    case AuraKind::Crusader:
    case AuraKind::StrengthChampion:
    case AuraKind::WrathWray:
        useWithUpdate(player, aura, &PlayerState::updateStrength,
                      aura.kind == AuraKind::WrathWray ? precounter : 0);
        if (aura.kind == AuraKind::WrathWray) player.itemtimer = durationMs(aura) - precounter;
        break;
    case AuraKind::Cloudkeeper:
        useItem(player, aura, precounter, &PlayerState::updateAuras, true);
        break;
    case AuraKind::Felstriker:
        useWithUpdate(player, aura, &PlayerState::update);
        break;
    case AuraKind::DeathWish:
        begin(player, aura, precounter);
        player.rage -= player.flag("altdreadnaughttwoset"_prop) ? 0 : 10;
        player.timer = 1500;
        player.updateDmgMod();
        setDelay(player, aura);
        break;
    case AuraKind::MightyRagePotion: {
        accountRefresh(player, aura);
        const double oldRage = player.rage;
        player.rage = std::min(player.rage + static_cast<double>(player.rng.integer(
            aura.props.number("value1"_prop), aura.props.number("value2"_prop))), 100.0);
        aura.timer = player.step + durationMs(aura) - precounter;
        aura.starttimer = player.step - precounter;
        player.updateStrength();
        setDelay(player, aura);
        consumedRage(player, oldRage);
        break;
    }
    case AuraKind::QuicknessPotion:
    case AuraKind::Bloodlust:
    case AuraKind::Empyrean:
    case AuraKind::Eskhandar:
    case AuraKind::Tempest:
    case AuraKind::Pummeler:
    case AuraKind::Hategrips:
    case AuraKind::VoidMadness:
    case AuraKind::Jackhammer:
    case AuraKind::GyromaticAcceleration:
    case AuraKind::GneuroLogical:
    case AuraKind::UnrelentingStrikes:
        useWithUpdate(player, aura, &PlayerState::updateHaste,
            (aura.kind == AuraKind::VoidMadness ||
             aura.kind == AuraKind::GyromaticAcceleration ||
             aura.kind == AuraKind::GneuroLogical) ? precounter : 0);
        break;
    case AuraKind::Chastise:
        useWithUpdate(player, aura, &PlayerState::updateHaste, precounter);
        break;
    case AuraKind::BloodFury:
        player.timer = 1500;
        useWithUpdate(player, aura, &PlayerState::updateAuras, precounter, true);
        break;
    case AuraKind::Berserking:
        begin(player, aura, precounter);
        player.rage -= 5;
        player.updateHaste();
        setDelay(player, aura);
        break;
    case AuraKind::Perception:
        useWithUpdate(player, aura, &PlayerState::update, precounter, true);
        break;
    case AuraKind::Zeal:
        if (player.timer && player.timer < 1500) return;
        useWithUpdate(player, aura, &PlayerState::updateBonusDmg);
        break;
    case AuraKind::Annihilator:
        if (player.flag("faeriefire"_prop) ||
            player.rng.tenK() < player.target.props.number("binaryresist"_prop)) return;
        begin(player, aura);
        aura.stacks = std::min(aura.stacks + 1, 3);
        player.updateArmorReduction();
        break;
    case AuraKind::Rivenspike:
    case AuraKind::Bonereaver:
        if (aura.kind == AuraKind::Rivenspike && player.flag("faeriefire"_prop)) return;
        begin(player, aura);
        aura.stacks = std::min(aura.stacks + 1, 3);
        player.updateArmorReduction();
        break;
    case AuraKind::Windfury:
        begin(player, aura);
        aura.timer = player.step + 1500;
        aura.mintime = detail::jsRemainder(player.step, player.prop("batching"_prop, 1));
        aura.stacks = 2;
        player.updateAP();
        ++player.extraattacks;
        break;
    case AuraKind::Swarmguard:
        aura.timer = player.step + durationMs(aura) - precounter;
        aura.starttimer = player.step - precounter;
        aura.stacks = 0;
        break;
    case AuraKind::Flask:
        player.timer = 1500;
        useItem(player, aura, precounter, &PlayerState::updateAuras, true);
        break;
    case AuraKind::Slayer:
    case AuraKind::Earthstrike:
    case AuraKind::RoarGuardian:
    case AuraKind::MoltenEmberstone:
        useItem(player, aura, precounter, &PlayerState::updateAP);
        break;
    case AuraKind::WorgenMark:
        useWithUpdate(player, aura, &PlayerState::updateAP);
        break;
    case AuraKind::Spider:
        useItem(player, aura, precounter, &PlayerState::updateHaste);
        break;
    case AuraKind::Gabbar:
        aura.stats.set("ap"_prop, aura.props.number("value"_prop));
        useItem(player, aura, precounter, &PlayerState::updateAP);
        break;
    case AuraKind::PrimalBlessing:
    case AuraKind::PrimalBlessing2:
    case AuraKind::SerpentAscension:
        if (aura.cooldownTimer > player.step) return;
        begin(player, aura);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        player.updateAP();
        break;
    case AuraKind::BloodrageAura:
    case AuraKind::BerserkerRageAura:
    case AuraKind::ConsumedRage:
    case AuraKind::SuddenDeath:
    case AuraKind::EchoesBattle:
    case AuraKind::EchoesZerk:
    case AuraKind::EchoesDef:
    case AuraKind::EchoesGlad:
        begin(player, aura);
        if (aura.kind == AuraKind::BloodrageAura) setDelay(player, aura);
        break;
    case AuraKind::Zandalarian:
        player.itemtimer = durationMs(aura) - precounter;
        begin(player, aura, precounter);
        aura.stats.set("moddmgdone"_prop, 40);
        player.updateBonusDmg();
        break;
    case AuraKind::BattleShout:
        begin(player, aura);
        if (!prepull) {
            player.rage -= aura.props.number("cost"_prop);
            player.timer = 1500;
        }
        player.updateAP();
        setDelay(player, aura);
        break;
    case AuraKind::Rend: {
        const Result result = player.rollMeleeAura(aura, player.mh);
        if (aura.data.size() < 5) aura.data.resize(5);
        ++aura.data[static_cast<std::size_t>(result)];
        if (result == Result::Miss) return;
        if (result == Result::Dodge) {
            player.dodgetimer = 5000;
            return;
        }
        accountRefresh(player, aura);
        aura.nexttick = player.step + 3000;
        aura.timer = player.step + durationMs(aura);
        player.timer = 1500;
        aura.starttimer = player.step;
        aura.stacks = aura.props.integer("value2"_prop);
        if (!player.isValidStance("def", true) && !player.isValidStance("battle", true)) {
            std::string stance = "battle";
            if (player.flag("switchdelay"_prop) && player.stance == "glad") {
                stance = player.props.string("basestance"_prop);
                if (stance == "glad") {
                    if (const auto* unstoppable = player.spell("unstoppablemight"_action))
                        stance = unstoppable->props.string("secondarystance"_prop, stance);
                }
            }
            player.switchStance(stance);
        }
        player.rage -= aura.props.number("cost"_prop);
        double baseDamage = aura.props.number("value1"_prop);
        const double value2 = aura.props.number("value2"_prop);
        if (player.flag("bloodfrenzy"_prop)) {
            baseDamage += aura.props.number("value1"_prop) +
                std::trunc(player.stats.number("ap"_prop) * 0.03 * value2);
        } else if (player.turtleMode) {
            baseDamage += std::trunc(player.stats.number("ap"_prop) * 0.05 * value2);
        }
        aura.props.set("tickdmg"_prop, baseDamage * player.stats.number("dmgmod"_prop, 1) *
            aura.props.number("dmgmod"_prop, 1) * player.prop("bleedmod"_prop, 1) / value2);
        player.updateDmgMod();
        setDelay(player, aura);
        break;
    }
    case AuraKind::Vibroblade:
    case AuraKind::Ultrasonic:
    case AuraKind::CleaveArmor:
        if (player.flag("faeriefire"_prop)) return;
        useWithUpdate(player, aura, &PlayerState::updateArmorReduction);
        break;
    case AuraKind::WeaponBleed:
        accountRefresh(player, aura);
        aura.nexttick = player.step + aura.props.number("interval"_prop);
        aura.timer = player.step + durationMs(aura);
        aura.starttimer = player.step;
        break;
    case AuraKind::Ragehammer:
        begin(player, aura);
        player.updateAP();
        player.updateHaste();
        break;
    case AuraKind::EchoesDread:
        if (aura.cooldownTimer > player.step) return;
        begin(player, aura);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        player.updateAP();
        player.updateHaste();
        break;
    case AuraKind::BlisteringRagehammer:
    case AuraKind::CrusaderZeal:
        begin(player, aura);
        player.updateBonusDmg();
        player.updateHaste();
        break;
    case AuraKind::Stoneslayer:
    case AuraKind::MeltArmor:
        useWithUpdate(player, aura, &PlayerState::updateBonusDmg);
        break;
    case AuraKind::MildlyIrradiated:
        useWithUpdate(player, aura, &PlayerState::updateAP, precounter);
        break;
    case AuraKind::Spicy: {
        if (!aura.firstuse) return;
        aura.timer = player.step + durationMs(aura);
        aura.starttimer = player.step;
        aura.firstuse = false;
        player.updateHaste();
        player.updateHasteDamage();
        ProcState proc;
        proc.props.set("chance"_prop, 500);
        proc.props.set("magicdmg"_prop, 7);
        proc.props.set("spicy"_prop, 1);
        proc.loadScalars();
        if (!player.attackproc1) player.attackproc1 = proc;
        if (!player.attackproc2) player.attackproc2 = proc;
        break;
    }
    case AuraKind::CoinFlip:
        aura.firstuse = false;
        if (aura.props.boolean("alwaystails"_prop)) return;
        if (aura.props.boolean("alwaysheads"_prop) || player.rng.tenK() < 5000) {
            aura.timer = player.step + durationMs(aura) - precounter;
            aura.starttimer = player.step - precounter;
            player.updateAuras();
        }
        break;
    case AuraKind::Rampage:
        useWithUpdate(player, aura, &PlayerState::updateAP, precounter, true);
        break;
    case AuraKind::WreckingCrew:
        begin(player, aura);
        player.mainspelldmg = 1.1;
        break;
    case AuraKind::VoodooFrenzy: {
        if (aura.cooldownTimer > player.step) return;
        begin(player, aura);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        aura.stats = PropertyBag{};
        const auto stat = player.stats.number("str"_prop) >= player.stats.number("agi"_prop)
            ? "str"_prop : "agi"_prop;
        aura.stats.set(stat, 35);
        player.updateAuras();
        break;
    }
    case AuraKind::RelentlessStrength:
        player.itemtimer = durationMs(aura) - precounter;
        begin(player, aura, precounter);
        aura.stats.set("moddmgdone"_prop, 20);
        player.updateBonusDmg();
        break;
    case AuraKind::FreshMeat:
        useWithUpdate(player, aura, &PlayerState::updateDmgMod);
        aura.firstuse = false;
        break;
    case AuraKind::WarriorsResolve: {
        const double oldRage = player.rage;
        player.rage = std::min(player.rage + 10, 100.0);
        consumedRage(player, oldRage);
        break;
    }
    case AuraKind::BattleForecast:
    case AuraKind::GladForecast: {
        begin(player, aura);
        player.updateAuras();
        setDelay(player, aura);
        const auto otherKey = aura.kind == AuraKind::BattleForecast
            ? "gladforecast"_action : "battleforecast"_action;
        if (auto* other = player.aura(otherKey)) {
            auraRemove(player, *other);
        }
        break;
    }
    case AuraKind::DefendersResolve:
        aura.stats.set("ap"_prop, 4 * player.stats.number("defense"_prop));
        useWithUpdate(player, aura, &PlayerState::updateAP, 0, true);
        break;
    case AuraKind::SingleMinded:
        begin(player, aura);
        aura.stacks = std::min(5, aura.stacks + 1);
        aura.multStats.set("haste"_prop, 2 * aura.stacks);
        player.updateHaste();
        break;
    case AuraKind::DemonTaintedBlood:
    case AuraKind::MoonstalkerFury:
        useItem(player, aura, precounter, &PlayerState::updateStrength);
        break;
    case AuraKind::MagmadarsReturn:
        if (aura.cooldownTimer > player.step) return;
        begin(player, aura);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        player.updateHaste();
        break;
    case AuraKind::JujuFlurry:
        begin(player, aura, precounter);
        player.updateHasteDamage();
        player.updateHaste();
        break;
    case AuraKind::GrilekGuard:
        useItem(player, aura, precounter, &PlayerState::updateAuras);
        break;
    case AuraKind::Shieldrender:
        useWithUpdate(player, aura, &PlayerState::updateArmorReduction);
        break;
    case AuraKind::Modrag:
        begin(player, aura);
        player.updateBonusDmg();
        ++player.extraattacks;
        break;
    case AuraKind::BattleStance:
    case AuraKind::DefensiveStance:
    case AuraKind::BerserkerStance:
    case AuraKind::GladiatorStance:
        basic();
        break;
    default:
        basic();
        break;
    }
}

bool auraStep(PlayerState& player, AuraState& aura) {
    if (aura.kind == AuraKind::Flurry || aura.kind == AuraKind::BattleStance ||
        aura.kind == AuraKind::DefensiveStance || aura.kind == AuraKind::BerserkerStance ||
        aura.kind == AuraKind::GladiatorStance) return true;

    switch (aura.kind) {
    case AuraKind::DeepWounds:
        while (player.step >= aura.nexttick) {
            player.stepAuras(true);
            const double damage = aura.saveddmg / aura.ticksleft;
            aura.saveddmg -= damage;
            aura.idmg += damage;
            aura.totaldmg += damage;
            --aura.ticksleft;
            aura.nexttick += 3000;
        }
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            aura.nexttick = 0;
            aura.saveddmg = 0;
            player.updateDmgMod();
            return false;
        }
        return true;
    case AuraKind::OldDeepWounds:
        while (player.step >= aura.nexttick) {
            const double min = player.mh.mindmg + player.mh.bonusdmg +
                player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * player.mh.speed;
            const double max = player.mh.maxdmg + player.mh.bonusdmg +
                player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * player.mh.speed;
            const double damage = (min + max) / 2.0 * player.mh.modifier *
                player.stats.number("dmgmod"_prop, 1) * player.talents.number("deepwounds"_prop) *
                player.prop("bleedmod"_prop, 1) / 4.0;
            aura.idmg += damage;
            aura.totaldmg += damage;
            aura.nexttick += 3000;
        }
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            return false;
        }
        return true;
    case AuraKind::PotentVenoms:
        while (player.step >= aura.nexttick) {
            const double damage = aura.props.number("dmg"_prop) * aura.stacks / 4.0;
            aura.idmg += damage;
            aura.totaldmg += damage;
            aura.nexttick += 3000;
        }
        if (player.step >= aura.timer) {
            expire(player, aura);
            aura.stacks = 0;
            return false;
        }
        return true;
    case AuraKind::Rend:
        while (player.step >= aura.nexttick && aura.stacks) {
            const double damage = aura.props.number("tickdmg"_prop);
            aura.idmg += damage;
            aura.totaldmg += damage;
            aura.nexttick += 3000;
            --aura.stacks;
            if (!aura.stacks) aura.uptime += player.step - aura.starttimer;
            if (player.flag("tasteforblood"_prop) && aura.tfbstep + 6000 <= player.step) {
                player.dodgetimer = 9000;
                aura.tfbstep = player.step;
            }
        }
        if (player.step >= aura.timer) {
            aura.timer = 0;
            aura.firstuse = false;
            player.updateDmgMod();
            return false;
        }
        return true;
    case AuraKind::WeaponBleed:
        return stepPeriodicDamage(player, aura, aura.props.number("interval"_prop),
                                  aura.props.number("dmg"_prop));
    case AuraKind::Gabbar:
        if (detail::jsRemainder(player.step - aura.starttimer, 2000.0) == 0) {
            aura.stats.set("ap"_prop, aura.stats.number("ap"_prop) + aura.props.number("value"_prop));
            player.updateAP();
        }
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::BloodrageAura:
        if (detail::jsRemainder(player.step - aura.starttimer, 1000.0) == 0) {
            player.rage = std::min(player.rage + 1, 100.0);
            if (player.rage >= 60 && player.rage < 81) {
                if (auto* consumed = player.aura("consumedrage"_action)) auraUse(player, *consumed);
            }
        }
        if (player.step >= aura.timer) {
            expire(player, aura);
            return false;
        }
        return true;
    case AuraKind::Windfury:
        if (player.step >= aura.timer || !aura.stacks) {
            expire(player, aura, true);
            aura.stacks = 0;
            player.updateAP();
            return false;
        }
        return true;
    case AuraKind::Swarmguard:
        if (player.step >= aura.timer) {
            expire(player, aura);
            aura.stacks = 0;
            aura.firstuse = false;
            player.updateArmorReduction();
            return false;
        }
        return true;
    case AuraKind::TwowEnrageAura:
    case AuraKind::FreshMeat:
        return stepWithUpdate(player, aura, &PlayerState::updateDmgMod);
    case AuraKind::Recklessness:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, false, true);
    case AuraKind::Crusader:
    case AuraKind::StrengthChampion:
        return stepWithUpdate(player, aura, &PlayerState::updateStrength);
    case AuraKind::Felstriker:
    case AuraKind::Perception:
        return stepWithUpdate(player, aura, &PlayerState::update, true);
    case AuraKind::DeathWish:
        return stepWithUpdate(player, aura, &PlayerState::updateDmgMod, false, true);
    case AuraKind::MightyRagePotion:
        return stepWithUpdate(player, aura, &PlayerState::updateStrength, true);
    case AuraKind::QuicknessPotion:
    case AuraKind::Chastise:
        return stepWithUpdate(player, aura, &PlayerState::updateHaste, false, true);
    case AuraKind::BloodFury:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, true);
    case AuraKind::Berserking:
    case AuraKind::Empyrean:
    case AuraKind::Eskhandar:
    case AuraKind::Tempest:
    case AuraKind::Pummeler:
    case AuraKind::Jackhammer:
    case AuraKind::UnrelentingStrikes:
        return stepWithUpdate(player, aura, &PlayerState::updateHaste, true);
    case AuraKind::Zeal:
    case AuraKind::Stoneslayer:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg, true);
    case AuraKind::Annihilator:
    case AuraKind::Rivenspike:
    case AuraKind::Bonereaver:
        return stepWithUpdate(player, aura, &PlayerState::updateArmorReduction, true);
    case AuraKind::MoltenEmberstone:
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::Slayer:
    case AuraKind::Earthstrike:
    case AuraKind::Spider:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, true);
    case AuraKind::Zandalarian:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg, true);
    case AuraKind::BerserkerRageAura:
    case AuraKind::SuddenDeath:
        if (player.step >= aura.timer) {
            expire(player, aura);
            return false;
        }
        return true;
    case AuraKind::BattleShout:
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::ConsumedRage:
        return stepWithUpdate(player, aura, &PlayerState::updateDmgMod, true);
    case AuraKind::Vibroblade:
    case AuraKind::Ultrasonic:
    case AuraKind::CleaveArmor:
        return stepWithUpdate(player, aura, &PlayerState::updateArmorReduction);
    case AuraKind::Ragehammer:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            player.updateAP();
            player.updateHaste();
            return false;
        }
        return true;
    case AuraKind::BlisteringRagehammer:
    case AuraKind::CrusaderZeal:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            player.updateBonusDmg();
            player.updateHaste();
            return false;
        }
        return true;
    case AuraKind::MildlyIrradiated:
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::Spicy:
        if (player.step < aura.timer) return true;
        expire(player, aura);
        player.updateHaste();
        player.updateHasteDamage();
        if (player.attackproc1 && player.attackproc1->props.boolean("spicy"_prop)) player.attackproc1.reset();
        if (player.attackproc2 && player.attackproc2->props.boolean("spicy"_prop)) player.attackproc2.reset();
        return false;
    case AuraKind::Rampage:
        return stepWithUpdate(player, aura, &PlayerState::updateAP, false, true);
    case AuraKind::WreckingCrew:
        if (player.step >= aura.timer) {
            expire(player, aura);
            player.mainspelldmg = 1;
            return false;
        }
        return true;
    case AuraKind::RelentlessStrength:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg, true);
    case AuraKind::DefendersResolve:
        return stepWithUpdate(player, aura, &PlayerState::updateAP);
    case AuraKind::MeltArmor:
    case AuraKind::Modrag:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg);
    case AuraKind::SingleMinded:
        if (player.step >= aura.timer) {
            expire(player, aura);
            aura.stacks = 0;
            player.updateHaste();
            return false;
        }
        return true;
    case AuraKind::DemonTaintedBlood:
    case AuraKind::MoonstalkerFury:
    case AuraKind::WrathWray:
        return stepWithUpdate(player, aura, &PlayerState::updateStrength, true);
    case AuraKind::JujuFlurry:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            aura.useStep = aura.starttimer + cooldownMs(aura);
            player.updateHasteDamage();
            player.updateHaste();
            return false;
        }
        return true;
    case AuraKind::GrilekGuard:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, true);
    case AuraKind::Shieldrender:
        return stepWithUpdate(player, aura, &PlayerState::updateArmorReduction, true);
    default:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            player.updateAuras();
            return false;
        }
        return true;
    }
}

void auraProc(PlayerState& player, AuraState& aura) {
    switch (aura.kind) {
    case AuraKind::Flurry:
        --aura.stacks;
        if (!aura.stacks) {
            aura.uptime += player.step - aura.starttimer;
            aura.timer = 0;
            player.updateHaste();
        }
        break;
    case AuraKind::Windfury:
        if (aura.stacks < 2) {
            if (player.step < aura.mintime) aura.timer = aura.mintime;
            else (void)auraStep(player, aura);
            aura.stacks = 0;
        } else {
            --aura.stacks;
        }
        break;
    case AuraKind::Swarmguard:
        aura.stacks = std::min(aura.stacks + 1, 6);
        player.updateArmorReduction();
        break;
    case AuraKind::Zandalarian:
        aura.stats.set("moddmgdone"_prop, aura.stats.number("moddmgdone"_prop) - 2);
        player.updateBonusDmg();
        if (aura.stats.number("moddmgdone"_prop) <= 0) {
            aura.timer = player.step;
            (void)auraStep(player, aura);
        }
        break;
    case AuraKind::RelentlessStrength:
        aura.stats.set("moddmgdone"_prop, aura.stats.number("moddmgdone"_prop) - 1);
        player.updateBonusDmg();
        if (aura.stats.number("moddmgdone"_prop) <= 0) {
            aura.timer = player.step;
            (void)auraStep(player, aura);
        }
        break;
    default:
        break;
    }
}

} // namespace warriorsim
