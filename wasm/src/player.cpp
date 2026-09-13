#include "engine.hpp"

#include <algorithm>
#include <cmath>
#include <string>

namespace warriorsim {
namespace {

double trunc32(double value) {
    return detail::jsToInt32(value);
}

bool isQueuedStrike(const SpellState* spell) {
    return spell && (spell->kind == SpellKind::HeroicStrike || spell->kind == SpellKind::Cleave);
}

bool isPhysical(const SpellState* spell) {
    return !spell || spell->props.integer("school"_prop, static_cast<int>(School::Physical)) ==
                         static_cast<int>(School::Physical);
}

double weaponDamage(PlayerState& player, WeaponState& weapon, const SpellState* heroic) {
    double damage = player.rng.integer(weapon.mindmg + weapon.bonusdmg,
                                       weapon.maxdmg + weapon.bonusdmg) +
                    (player.stats.number("ap"_prop) / 14.0) * weapon.speed +
                    player.stats.number("moddmgdone"_prop);
    double mod = 1;
    if (heroic) damage += heroic->props.number("bonus"_prop, heroic->props.number("value1"_prop));
    if (heroic && heroic->kind == SpellKind::HeroicStrike && player.flag("heroicbonus"_prop)) mod = 1.25;
    return damage * weapon.modifier * player.stats.number("dmgmod"_prop, 1) * mod +
           player.stats.number("moddmgtaken"_prop);
}

double averageWeaponDamage(const PlayerState& player, const WeaponState& weapon) {
    double damage = ((weapon.mindmg + weapon.bonusdmg + weapon.maxdmg + weapon.bonusdmg) / 2.0) +
                    (player.stats.number("ap"_prop) / 14.0) * weapon.normSpeed +
                    player.stats.number("moddmgdone"_prop);
    damage = damage * weapon.modifier * player.stats.number("dmgmod"_prop, 1) +
             player.stats.number("moddmgtaken"_prop);
    return damage * (1 - player.armorReduction);
}

void useWeapon(PlayerState& player, WeaponState& weapon) {
    // Math.round is floor(x + .5) for the non-negative swing timers used here.
    weapon.timer = std::floor(weapon.speed * 1000.0 / player.stats.number("haste"_prop, 1) + 0.5);
    if (!weapon.offhand) {
        if (auto* slam = player.spell("slam"_action); slam && slam->props.boolean("afterswing"_prop)) {
            slam->props.set("mhthreshold"_prop, weapon.timer - 1000);
        }
    }
}

void addActiveStats(PropertyBag& destination, const PropertyBag& delta) {
    for (const std::uint16_t index : delta.denseNumberSlots) {
        const auto i = static_cast<std::size_t>(index);
        const double current = destination.denseNumberPresent.test(i) ? destination.denseNumbers[i] : 0;
        destination.denseNumbers[i] = current + delta.denseNumbers[i];
        destination.denseNumberPresent.set(i);
        destination.denseNumberFromString.reset(i);
    }
    for (const auto& [key, value] : delta.numbers)
        destination.set(key, destination.number(key) + value);
}

void applyActiveMultipliers(PropertyBag& destination, const PropertyBag& multiplier) {
    for (const std::uint16_t index : multiplier.denseNumberSlots) {
        const auto i = static_cast<std::size_t>(index);
        const double current = destination.denseNumberPresent.test(i) ? destination.denseNumbers[i] : 0;
        destination.denseNumbers[i] = current * (1 + multiplier.denseNumbers[i] / 100.0);
        destination.denseNumberPresent.set(i);
        destination.denseNumberFromString.reset(i);
    }
    for (const auto& [key, value] : multiplier.numbers)
        destination.set(key, destination.number(key) * (1 + value / 100.0));
}

bool active(const PlayerState& player, detail::KnownAction key) {
    const auto* value = player.aura(key);
    return value && value->timer != 0;
}

double auraStat(const PlayerState& player, detail::KnownAction key, detail::KnownProperty stat) {
    const auto* value = player.aura(key);
    return value && value->timer ? value->stats.number(stat) : 0;
}

double auraMult(const PlayerState& player, detail::KnownAction key, detail::KnownProperty stat) {
    const auto* value = player.aura(key);
    return value && value->timer ? value->multStats.number(stat) : 0;
}

void activateProcReference(PlayerState& player, ProcState& proc) {
    if (proc.spellAura != kNoRef) auraUse(player, player.auras[static_cast<std::size_t>(proc.spellAura)]);
    if (proc.spellSpell != kNoRef) spellUse(player, player.spells[static_cast<std::size_t>(proc.spellSpell)]);
}

} // namespace

void PlayerState::reset(double startingRage) {
    rage = startingRage;
    timer = itemtimer = stancetimer = ragetimer = dodgetimer = crittimer = 0;
    critdmgbonus = 0;
    mainspelldmg = 1;
    spelldelay = heroicdelay = 0;
    mh.timer = 0;
    extraattacks = batchedextras = 0;
    nextswinghs = nextswingcl = freeslam = freeshieldslam = false;
    for (auto& value : spells) {
        value.timer = 0;
        value.stacks = 0;
        value.usedrage = 0;
        value.maxdelay = props.number("reactionmin"_prop);
        if (value.props.has("unqueuetimer"_prop))
            value.props.set("unqueuetimer"_prop, 300 + rng.integer(props.number("reactionmin"_prop), props.number("reactionmax"_prop)));
        if (value.backupHeroic) {
            value.backupHeroic->timer = 0;
            value.backupHeroic->stacks = 0;
            value.backupHeroic->maxdelay = props.number("reactionmin"_prop);
            value.backupHeroic->props.set("unqueuetimer"_prop, 300 + rng.integer(props.number("reactionmin"_prop), props.number("reactionmax"_prop)));
        }
    }
    for (auto& value : auras) {
        value.timer = 0;
        value.firstuse = true;
        value.stacks = 0;
        value.starttimer = 0;
        value.maxdelay = props.number("reactionmin"_prop);
        value.mintime = 0;
        value.ticksleft = 0;
        value.saveddmg = 0;
        value.nexttick = 0;
        value.cooldownTimer = 0;
        value.tfbstep = -6000;
        if (value.kind == AuraKind::DeepWounds || value.kind == AuraKind::OldDeepWounds ||
            value.kind == AuraKind::PotentVenoms || value.kind == AuraKind::Rend ||
            value.kind == AuraKind::WeaponBleed) value.idmg = 0;
    }
    if (trinketproc1 && trinketproc1->useStep) trinketproc1->useStep = 0;
    if (trinketproc2 && trinketproc2->useStep) trinketproc2->useStep = 0;
    if (auto* value = spell("fireball"_action)) value->idmg = 0;
    if (auto* value = spell("gunaxe"_action)) value->idmg = 0;
    if (auto* value = spell("themoltencore"_action)) value->idmg = 0;

    stance = props.string("basestance"_prop, "battle");
    if (auto* value = aura("battlestance"_action)) value->timer = stance == "battle" ? 1 : 0;
    if (auto* value = aura("berserkerstance"_action)) value->timer = stance == "zerk" ? 1 : 0;
    if (auto* value = aura("defensivestance"_action)) value->timer = stance == "def" ? 1 : 0;
    if (auto* value = aura("gladiatorstance"_action)) value->timer = stance == "glad" ? 1 : 0;
    if (auto* value = spell("unstoppablemight"_action); value && value->props.boolean("switchstart"_prop))
        switchStance(value->props.string("secondarystance"_prop));
    update();
    if (oh) oh->timer = std::floor(oh->speed * 1000.0 / stats.number("haste"_prop, 1) / 2.0 + 0.5);
}

void PlayerState::update() {
    updateAuras();
    updateArmorReduction();
    mh.skill = stats.number("skill_" + std::to_string(mh.type));
    mh.glanceChance = glanceChance(mh);
    mh.miss = missChance(mh);
    mh.dwmiss = mh.miss;
    mh.dodge = dodgeChance(mh);
    mh.effectiveCrit = effectiveCrit(mh);
    if (oh) {
        oh->skill = stats.number("skill_" + std::to_string(oh->type));
        mh.dwmiss = dwMissChance(mh);
        oh->glanceChance = glanceChance(*oh);
        oh->miss = missChance(*oh);
        oh->dwmiss = dwMissChance(*oh);
        if (turtleMode) oh->dwmiss -= talents.number("offhit"_prop);
        oh->dodge = dodgeChance(*oh);
        oh->effectiveCrit = effectiveCrit(*oh);
    }
}

void PlayerState::updateAuras() {
    stats = base;
    for (const auto& value : auras) {
        if (!value.timer) continue;
        addActiveStats(stats, value.stats);
        applyActiveMultipliers(stats, value.multStats);
    }
    stats.set("str"_prop, trunc32(stats.number("str"_prop) * stats.number("strmod"_prop, 1)));
    stats.set("agi"_prop, trunc32(stats.number("agi"_prop) * stats.number("agimod"_prop, 1)));
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    stats.set("crit"_prop, stats.number("crit"_prop) + stats.number("agi"_prop) * props.number("agipercrit"_prop));
    crit = critChance();
    stats.set("block"_prop, stats.number("block"_prop) + trunc32(stats.number("str"_prop) / 20));
    if (stats.number("baseapmod"_prop, 1) != 1) {
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    }
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateStrength() {
    stats.set("str"_prop, base.number("str"_prop));
    stats.set("ap"_prop, base.number("ap"_prop));
    stats.set("apmod"_prop, base.number("apmod"_prop, 1));
    stats.set("baseapmod"_prop, base.number("baseapmod"_prop, 1));
    for (const auto& value : auras) {
        if (!value.timer) continue;
        stats.set("str"_prop, stats.number("str"_prop) + value.stats.number("str"_prop));
        stats.set("ap"_prop, stats.number("ap"_prop) + value.stats.number("ap"_prop));
        if (value.multStats.number("apmod"_prop))
            stats.set("apmod"_prop, stats.number("apmod"_prop) * (1 + value.multStats.number("apmod"_prop) / 100));
        if (value.multStats.number("baseapmod"_prop))
            stats.set("baseapmod"_prop, stats.number("baseapmod"_prop) * (1 + value.multStats.number("baseapmod"_prop) / 100));
    }
    stats.set("str"_prop, trunc32(stats.number("str"_prop) * stats.number("strmod"_prop, 1)));
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    stats.set("block"_prop, base.number("block"_prop) + trunc32(stats.number("str"_prop) / 20));
    if (stats.number("baseapmod"_prop, 1) != 1)
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateAP() {
    stats.set("ap"_prop, base.number("ap"_prop));
    stats.set("apmod"_prop, base.number("apmod"_prop, 1));
    // Existing JS initializes this from base.apmod (not base.baseapmod).
    stats.set("baseapmod"_prop, base.number("apmod"_prop, 1));
    for (const auto& value : auras) {
        if (!value.timer) continue;
        stats.set("ap"_prop, stats.number("ap"_prop) + value.stats.number("ap"_prop));
        if (value.multStats.number("apmod"_prop))
            stats.set("apmod"_prop, stats.number("apmod"_prop) * (1 + value.multStats.number("apmod"_prop) / 100));
        if (value.multStats.number("baseapmod"_prop))
            stats.set("baseapmod"_prop, stats.number("baseapmod"_prop) * (1 + value.multStats.number("baseapmod"_prop) / 100));
    }
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    if (stats.number("baseapmod"_prop, 1) != 1)
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateHaste() {
    stats.set("haste"_prop, base.number("haste"_prop, 1));
    stats.set("castspeed"_prop, base.number("castspeed"_prop, 1));
    const auto apply = [this](detail::KnownAction key, bool affectsCastSpeed) {
        const auto* value = aura(key);
        if (!value || !value->timer) return;
        const double multiplier = 1 + value->multStats.number("haste"_prop) / 100;
        stats.set("haste"_prop, stats.number("haste"_prop) * multiplier);
        if (affectsCastSpeed) stats.set("castspeed"_prop, stats.number("castspeed"_prop) * multiplier);
    };
    // Preserve the source's literal order.  Besides intentionally excluding
    // unrelated auras, it fixes the exact floating-point event times for Slam.
    apply("flurry"_action, true);
    apply("quicknesspotion"_action, true);
    apply("bloodlust"_action, true);
    apply("berserking"_action, true);
    apply("empyrean"_action, false);
    apply("eskhandar"_action, false);
    apply("tempest"_action, false);
    apply("pummeler"_action, false);
    apply("spider"_action, false);
    apply("hategrips"_action, false);
    apply("voidmadness"_action, false);
    apply("jackhammer"_action, false);
    apply("ragehammer"_action, false);
    apply("blisteringragehammer"_action, false);
    apply("gyromaticacceleration"_action, false);
    apply("gneurological"_action, false);
    apply("spicy"_action, false);
    apply("echoesdread"_action, false);
    apply("singleminded"_action, false);
    apply("magmadarsreturn"_action, false);
    apply("jujuflurry"_action, true);
    apply("chastise"_action, true);
    apply("crusaderzeal"_action, false);
    apply("obsidianhaste"_action, false);
    apply("unrelentingstrikes"_action, false);
}

void PlayerState::updateHasteDamage() {
    double mod = 1;
    if (active(*this, "spicy"_action)) mod *= 1 + auraMult(*this, "spicy"_action, "haste"_prop) / 100;
    if (active(*this, "jujuflurry"_action) && !turtleMode)
        mod *= 1 + auraMult(*this, "jujuflurry"_action, "haste"_prop) / 100;
    mh.mindmg = mh.baseMindmg / mod;
    mh.maxdmg = mh.baseMaxdmg / mod;
    if (oh) { oh->mindmg = oh->baseMindmg / mod; oh->maxdmg = oh->baseMaxdmg / mod; }
}

void PlayerState::updateBonusDmg() {
    double bonus = 0;
    double taken = 0;
    constexpr detail::KnownAction bonusKeys[] = {"stoneslayer"_action, "zeal"_action, "zandalarian"_action,
        "relentlessstrength"_action, "blisteringragehammer"_action, "crusaderzeal"_action, "obsidianhaste"_action, "modrag"_action};
    for (const auto key : bonusKeys) bonus += auraStat(*this, key, "moddmgdone"_prop);
    taken += auraStat(*this, "meltarmor"_action, "moddmgtaken"_prop);
    stats.set("moddmgdone"_prop, base.number("moddmgdone"_prop) + bonus);
    stats.set("moddmgtaken"_prop, base.number("moddmgtaken"_prop) + taken);
    mh.bonusdmg = mh.baseBonusdmg;
    if (oh) oh->bonusdmg = oh->baseBonusdmg;
}

void PlayerState::updateArmorReduction() {
    stats.set("arp"_prop, base.number("arp"_prop));
    if (talents.number("macearp"_prop)) stats.set("arp"_prop, stats.number("arp"_prop) + (mh.arp ? mh.arp : oh ? oh->arp : 0));
    target.armor = std::max(target.props.number("basearmorbuffed"_prop) - stats.number("arp"_prop), 0.0);
    const auto subtractStacked = [this](detail::KnownAction key) {
        if (const auto* value = aura(key); value && value->timer)
            target.armor = std::max(target.armor - value->stacks * value->props.number("armor"_prop), 0.0);
    };
    const auto subtractFlat = [this](detail::KnownAction key) {
        if (const auto* value = aura(key); value && value->timer)
            target.armor = std::max(target.armor - value->props.number("armor"_prop), 0.0);
    };
    subtractStacked("annihilator"_action);
    subtractStacked("rivenspike"_action);
    subtractFlat("vibroblade"_action);
    subtractFlat("ultrasonic"_action);
    subtractFlat("cleavearmor"_action);
    subtractStacked("bonereaver"_action);
    subtractStacked("swarmguard"_action);
    if (active(*this, "shieldrender"_action)) target.armor = 0;
    armorReduction = getArmorReduction();
    arpContribution = getArpContribution();
}

void PlayerState::updateDmgMod() {
    stats.set("dmgmod"_prop, base.number("dmgmod"_prop, 1));
    stats.set("spelldmgmod"_prop, base.number("spelldmgmod"_prop, 1));
    for (const auto& value : auras) if (value.timer && value.multStats.number("dmgmod"_prop))
        stats.set("dmgmod"_prop, stats.number("dmgmod"_prop) * (1 + value.multStats.number("dmgmod"_prop) / 100));
    if (flag("bleedbonus"_prop) && active(*this, "rend"_action) && active(*this, "deepwounds"_action))
        stats.set("dmgmod"_prop, stats.number("dmgmod"_prop) * 1.1);
}

double PlayerState::glanceReduction(const WeaponState& weapon) {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    double low, high;
    if (turtleMode) {
        low = std::clamp(0.9 - 0.023 * diff, 0.01, 0.9);
        high = std::clamp(1.0 - 0.017 * diff, 0.20, 1.0);
    } else {
        low = std::clamp(1.3 - 0.05 * diff, 0.01, 0.91);
        high = std::clamp(1.2 - 0.03 * diff, 0.2, 0.99);
    }
    return rng.next() * (high - low) + low;
}

double PlayerState::glanceChance(const WeaponState& weapon) const {
    return 10 + std::max(target.props.number("defense"_prop) -
        std::min(props.number("level"_prop) * 5, weapon.skill), 0.0) * 2;
}

double PlayerState::missChance(const WeaponState& weapon) const {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    if (turtleMode) return 5 + std::max(diff * .2, 0.0) - stats.number("hit"_prop);
    return 5 + (diff > 10 ? diff * .2 : diff * .1) - (diff > 10 ? stats.number("hit"_prop) - 1 : stats.number("hit"_prop));
}

double PlayerState::dwMissChance(const WeaponState& weapon) const {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    double miss = turtleMode ? 5 + std::max(diff * .2, 0.0) :
                  5 + (diff > 10 ? diff * .2 : diff * .1);
    miss = miss * .8 + 20;
    return miss - (!turtleMode && diff > 10 ? stats.number("hit"_prop) - 1 : stats.number("hit"_prop));
}

double PlayerState::critChance() const {
    return std::max(stats.number("crit"_prop) + talents.number("crit"_prop) +
                    (props.number("level"_prop) - target.props.number("level"_prop)) -
                    (target.props.number("level"_prop) - props.number("level"_prop) >= 3 ? 1.8 : 0), 0.0);
}

double PlayerState::effectiveCrit(const WeaponState& weapon) const {
    return std::max(0.0, crit + weapon.crit +
        (weapon.skill - target.props.number("defense"_prop)) * .04 +
        (props.string("basestance"_prop) == "zerk" ? 3 : 0));
}

double PlayerState::dodgeChance(const WeaponState& weapon) const {
    return std::max(5 - stats.number("expertise"_prop) - props.number("dodgetimeworn"_prop) - target.props.number("dodge"_prop) +
                    (target.props.number("defense"_prop) - weapon.skill) * .1, 0.0);
}

double PlayerState::getArmorReduction() const {
    const double armor = std::isnan(target.armor) ? 0 : target.armor;
    return std::min(armor / (armor + 400 + 85 * props.number("level"_prop)), .75);
}

double PlayerState::getArpContribution() const {
    const double level = props.number("level"_prop);
    double baseReduction = target.props.number("basearmorbuffed"_prop) /
        (target.props.number("basearmorbuffed"_prop) + 400 + 85 * level);
    double withArp = target.armor / (target.armor + 400 + 85 * level);
    return (1 - std::min(withArp, .75)) / (1 - std::min(baseReduction, .75)) - 1;
}

bool PlayerState::stepTimer(double amount) {
    if (timer <= amount) { timer = 0; return true; }
    timer -= amount; return false;
}
bool PlayerState::stepItemTimer(double amount) {
    if (itemtimer <= amount) { itemtimer = 0; return true; }
    itemtimer -= amount; return false;
}
bool PlayerState::stepStanceTimer(double amount) {
    if (stancetimer <= amount) { stancetimer = 0; return true; }
    stancetimer -= amount; return false;
}
void PlayerState::stepRageTimer(double amount) {
    if (ragetimer <= amount) { ragetimer = 0; rage += 10; } else ragetimer -= amount;
}
void PlayerState::stepDodgeTimer(double amount) {
    if (dodgetimer <= amount) dodgetimer = 0; else dodgetimer -= amount;
}

void PlayerState::stepAuras(bool noBleeds) {
    for (const auto& entry : configured.stepAuras) {
        if (entry.skipWhenNoBleeds && noBleeds) continue;
        if (entry.requireAdjacent && !prop("adjacent"_prop)) continue;
        auto& value = auras[static_cast<std::size_t>(entry.index)];
        if (value.timer && (!entry.requireFirstUse || value.firstuse))
            (void)auraStep(*this, value);
    }
}

void PlayerState::endAuras() {
    for (const auto& entry : configured.endAuras) {
        auto& value = auras[static_cast<std::size_t>(entry.index)];
        if (value.timer && (!entry.requireFirstUse || value.firstuse))
            auraEnd(*this, value);
    }
}

Result PlayerState::rollWeapon(WeaponState& weapon) {
    double tmp = 0;
    const int roll = rng.tenK();
    double miss = weapon.dwmiss;
    if (nextswinghs && turtleMode && !weapon.offhand) miss = weapon.miss;
    if (nextswinghs && !turtleMode) miss = weapon.miss;
    tmp += std::max(miss, 0.0) * 100;
    if (roll < tmp) return Result::Miss;
    tmp += weapon.dodge * 100; if (roll < tmp) return Result::Dodge;
    tmp += weapon.glanceChance * 100; if (roll < tmp) return Result::Glance;
    tmp += (crit + weapon.crit) * 100; if (roll < tmp) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMeleeSpell(SpellState& value, WeaponState& weapon) {
    double tmp = std::max(weapon.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) return Result::Miss;
    if (value.props.boolean("canDodge"_prop, true)) {
        tmp += weapon.dodge * 100;
        if (roll < tmp) return Result::Dodge;
    }
    if (!value.props.boolean("weaponspell"_prop, true)) { roll = rng.tenK(); tmp = 0; }
    double valueCrit = crit + weapon.crit;
    if (value.kind == SpellKind::Overpower) valueCrit += talents.number("overpowercrit"_prop);
    tmp += valueCrit * 100;
    if (roll < tmp && !value.props.boolean("nocrit"_prop)) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMeleeAura(AuraState& value, WeaponState& weapon) {
    double tmp = std::max(weapon.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) return Result::Miss;
    if (value.props.boolean("canDodge"_prop, true)) {
        tmp += weapon.dodge * 100;
        if (roll < tmp) return Result::Dodge;
    }
    // Aura's base class does not define weaponspell. Rend therefore follows
    // JavaScript's `!undefined` branch and consumes a separate crit-table roll.
    if (!value.props.boolean("weaponspell"_prop)) { roll = rng.tenK(); tmp = 0; }
    tmp += (crit + weapon.crit) * 100;
    if (roll < tmp && !value.props.boolean("nocrit"_prop)) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMagicSpell(SpellState& value) {
    double miss = value.props.boolean("binaryspell"_prop) ? target.props.number("binaryresist"_prop) : target.props.number("misschance"_prop);
    if (rng.tenK() < miss) return Result::Miss;
    if (rng.tenK() < stats.number("spellcrit"_prop) * 100) return Result::Crit;
    return Result::Hit;
}

void PlayerState::addRage(double dmg, Result result, WeaponState& weapon, const SpellState* ability) {
    double oldRage = rage;
    if (!ability || isQueuedStrike(ability)) {
        if (result != Result::Miss && result != Result::Dodge && talents.number("umbridledwrath"_prop) &&
            rng.tenK() < talents.number("umbridledwrath"_prop) * 100) {
            rage += 1;
            if (turtleMode && weapon.twohand) rage += 1;
        }
    }
    if (ability) {
        if (ability->kind == SpellKind::Execute)
            const_cast<SpellState*>(ability)->lastResult = result;
        if (result == Result::Miss || result == Result::Dodge) {
            rage += ability->props.boolean("refund"_prop, true) ? ability->props.number("cost"_prop) * .8 : 0;
            oldRage += ability->props.number("cost"_prop) + ability->usedrage;
        }
        if (result == Result::Hit && flag("altmightthreeset"_prop) && rng.tenK() < 1000) rage += 15;
    } else {
        if (result == Result::Dodge)
            rage += (averageWeaponDamage(*this, weapon) / props.number("rageconversion"_prop)) * 7.5 * .75;
        else if (result != Result::Miss)
            rage += (dmg / props.number("rageconversion"_prop)) * 7.5 * props.number("ragemod"_prop, 1);
    }
    if (props.number("extrarage"_prop) && result == Result::Hit) rage += props.number("extrarage"_prop);
    if (props.number("extracritrage"_prop) && result == Result::Crit) rage += props.number("extracritrage"_prop);
    rage = std::min(rage, props.number("ragecap"_prop, 100));
    if (auto* consumed = aura("consumedrage"_action); consumed && oldRage < 60 && rage >= 60)
        auraUse(*this, *consumed);
}

void PlayerState::addRageMh(double dmg, Result result, WeaponState& weapon, const SpellState* ability) {
    if (!ability || isQueuedStrike(ability)) {
        if (result != Result::Miss && result != Result::Dodge && talents.number("umbridledwrath"_prop) &&
            rng.tenK() < talents.number("umbridledwrath"_prop) * 100) {
            rage += 1;
            if (turtleMode && weapon.twohand) rage += 1;
        }
    }
    if (ability) {
        if (ability->kind == SpellKind::Execute) const_cast<SpellState*>(ability)->lastResult = result;
        if (result == Result::Miss || result == Result::Dodge)
            rage += ability->props.boolean("refund"_prop, true) ? ability->props.number("cost"_prop) * .8 : 0;
        if (result == Result::Miss && flag("altmightthreeset"_prop)) rage += 15;
    } else if (result == Result::Dodge) {
        rage += (averageWeaponDamage(*this, weapon) / props.number("rageconversion"_prop)) * 7.5 * .75;
    } else if (result != Result::Miss && result != Result::Crit) {
        rage += ((dmg / props.number("rageconversion"_prop) * 7.5) / 1.075) + (mh.speed * 3.5 / 2.25);
    } else if (result == Result::Crit) {
        rage += ((dmg / props.number("rageconversion"_prop) * 7.5) / 1.075) + (mh.speed * 7.5 / 2.25);
    }
    rage = std::min(rage, props.number("ragecap"_prop, 100));
}

void PlayerState::addRageOh(double dmg, Result result, WeaponState& weapon, const SpellState* ability) {
    if (!ability && result != Result::Miss && result != Result::Dodge && talents.number("umbridledwrath"_prop) &&
        rng.tenK() < talents.number("umbridledwrath"_prop) * 100) rage += 1;
    if (result == Result::Dodge)
        rage += (averageWeaponDamage(*this, weapon) / props.number("rageconversion"_prop)) * 7.5 * .75;
    else if (result != Result::Miss && result != Result::Crit)
        rage += ((dmg / props.number("rageconversion"_prop) * 7.5) / 1.075) + ((oh ? oh->speed : weapon.speed) * 1.75 / 2.4);
    else if (result == Result::Crit)
        rage += ((dmg / props.number("rageconversion"_prop) * 7.5) / 1.075) + ((oh ? oh->speed : weapon.speed) * 3.5 / 2.25);
    rage = std::min(rage, props.number("ragecap"_prop, 100));
}

double PlayerState::attackMh(WeaponState& weapon, int adjacent, double damageSoFar) {
    stepAuras();
    SpellState* ability = nullptr;
    Result result;
    if (nextswinghs) {
        nextswinghs = false;
        auto* heroic = spell("heroicstrike"_action);
        auto* cleave = spell("cleave"_action);
        if (heroic && heroic->props.number("cost"_prop) <= rage) {
            result = rollMeleeSpell(*heroic, mh);
            ability = heroic;
            rage -= ability->props.number("cost"_prop);
        } else if (cleave && cleave->props.number("cost"_prop) <= rage) {
            result = rollMeleeSpell(*cleave, mh);
            ability = cleave;
            if (adjacent) rage -= ability->props.number("cost"_prop);
        } else result = rollWeapon(weapon);
    } else result = rollWeapon(weapon);

    if (ability) if (auto* raging = spell("ragingblow"_action); raging && raging->timer &&
        isEnraged() && ability != raging && ability->props.boolean("offensive"_prop, true))
        raging->timer = std::max(0.0, raging->timer - 1000);

    double dmg = weaponDamage(*this, weapon, ability);
    const double procDmg = procAttack(ability, weapon, result, adjacent, damageSoFar);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Glance) dmg *= glanceReduction(weapon);
    if (result == Result::Crit) {
        const double abilityBonus = ability ? talents.number("abilitiescrit"_prop) +
            (flag("altdreadnaughtfourset"_prop) ? .04 : 0) : 0;
        dmg *= 1 + (1 + abilityBonus) * (1 + critdmgbonus * 2);
        procCrit(false, adjacent, ability);
    }
    useWeapon(*this, weapon);
    double done = dealDamage(dmg, result, weapon, ability, adjacent != 0);
    const auto index = static_cast<std::size_t>(result);
    if (ability) {
        ability->totaldmg += done;
        if (!adjacent) ++ability->data[index];
    } else {
        weapon.totaldmg += done;
        ++weapon.data[index];
    }
    weapon.totalprocdmg += procDmg;
    if (ability && ability->kind == SpellKind::Cleave && !adjacent) {
        nextswinghs = true;
        done += attackMh(weapon, 1, done);
    }
    return done + procDmg;
}

double PlayerState::attackOh(WeaponState& weapon) {
    stepAuras();
    const Result result = rollWeapon(weapon);
    double dmg = weaponDamage(*this, weapon, nullptr);
    const double procDmg = procAttack(nullptr, weapon, result, 0, 0);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Glance) dmg *= glanceReduction(weapon);
    if (result == Result::Crit) {
        dmg *= 1 + (1 + critdmgbonus * 2);
        procCrit(true, 0, nullptr);
    }
    useWeapon(*this, weapon);
    const double done = dealDamage(dmg, result, weapon, nullptr, false);
    ++weapon.data[static_cast<std::size_t>(result)];
    weapon.totaldmg += done;
    weapon.totalprocdmg += procDmg;
    return done + procDmg;
}

double PlayerState::cast(SpellState& ability, SpellState* delayedHeroic, int adjacent,
                         double damageSoFar) {
    if (!adjacent) { stepAuras(); spellUse(*this, ability, delayedHeroic); }
    if (ability.props.boolean("useonly"_prop)) return 0;
    if (auto* raging = spell("ragingblow"_action); raging && raging->timer && isEnraged() &&
        &ability != raging && ability.props.boolean("offensive"_prop, true))
        raging->timer = std::max(0.0, raging->timer - 1000);
    double dmg = spellDamage(*this, ability) * mh.modifier;
    if (dmg) dmg += stats.number("moddmgtaken"_prop);
    Result result = Result::Hit;
    const int defenseType = ability.props.integer("defenseType"_prop, 2);
    if (defenseType == 2) result = rollMeleeSpell(ability, mh);
    else if (defenseType == 1) result = rollMagicSpell(ability);
    double procDmg = procAttack(&ability, mh, result, adjacent, damageSoFar);
    if (ability.kind == SpellKind::SunderArmor)
        procDmg += procAttack(&ability, mh, result, adjacent, damageSoFar);
    if (result == Result::Miss || result == Result::Dodge) {
        if (ability.kind == SpellKind::SunderArmor) --ability.stacks;
        if (result == Result::Dodge) dodgetimer = 5000;
    } else if (result == Result::Crit) {
        if (defenseType == 1)
            dmg *= 1 + .5 * (1 + talents.number("abilitiescrit"_prop) +
                (flag("altdreadnaughtfourset"_prop) ? .04 : 0)) * (1 + critdmgbonus * 3);
        else
            dmg *= 1 + (1 + talents.number("abilitiescrit"_prop) +
                (flag("altdreadnaughtfourset"_prop) ? .04 : 0)) * (1 + critdmgbonus * 2);
        procCrit(false, adjacent, &ability);
    }
    const double done = dealDamage(dmg, result, mh, &ability, adjacent != 0);
    if (!adjacent) ++ability.data[static_cast<std::size_t>(result)];
    ability.totaldmg += done;
    mh.totalprocdmg += procDmg;
    (void)delayedHeroic; // consumed by Execute's spellUse implementation.
    return done + procDmg;
}

double PlayerState::castOh(SpellState& ability, int adjacent, double damageSoFar) {
    if (!oh) return 0;
    double dmg = spellDamage(*this, ability, &*oh) * oh->modifier;
    if (dmg) dmg += stats.number("moddmgtaken"_prop);
    const Result result = rollMeleeSpell(ability, *oh);
    const double procDmg = procAttack(&ability, *oh, result, adjacent, damageSoFar);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Crit) {
        dmg *= 1 + (1 + talents.number("abilitiescrit"_prop) +
            (flag("altdreadnaughtfourset"_prop) ? .04 : 0)) * (1 + critdmgbonus * 2);
        procCrit(false, adjacent, &ability);
    }
    const double done = dealDamage(dmg, result, *oh, &ability, adjacent != 0);
    ability.totaldmg += done;
    ability.offhandhit = false;
    oh->totalprocdmg += procDmg;
    return done + procDmg;
}

double PlayerState::dealDamage(double dmg, Result result, WeaponState& weapon,
                               SpellState* ability, bool adjacent) {
    const bool landed = result != Result::Miss && result != Result::Dodge;
    if (landed && isPhysical(ability)) dmg *= 1 - armorReduction;
    if (!adjacent) {
        if (!turtleMode) addRage(dmg, result, weapon, ability);
        else if (&weapon == &mh) addRageMh(dmg, result, weapon, ability);
        else addRageOh(dmg, result, weapon, ability);
    }
    return landed ? dmg : 0;
}

void PlayerState::procCrit(bool offhand, int adjacent, SpellState* ability) {
    crittimer = 1;
    if (auto* value = aura("flurry"_action)) auraUse(*this, *value);
    if (auto* value = aura("deepwounds"_action)) {
        if (!adjacent) auraUse(*this, *value, offhand);
        else {
            const auto index = rng.integer(1, adjacent) + 1;
            if (auto* other = aura("deepwounds" + std::to_string(index))) auraUse(*this, *other, offhand);
        }
    }
    if (auto* value = aura("wreckingcrew"_action)) auraUse(*this, *value);
    if (flag("overpowerrend"_prop) && ability && ability->kind == SpellKind::Overpower) {
        if (auto* value = aura("rend"_action); value && value->timer) {
            value->timer = value->nexttick - 3000 + value->props.number("duration"_prop) * 1000;
            value->stacks = value->props.integer("value2"_prop);
        }
    }
}

double PlayerState::magicProc(const ProcState& proc) {
    double mod = 1;
    double miss = target.props.number("misschance"_prop);
    double dmg = proc.magicDamage;
    if (proc.binarySpell) miss = target.props.number("binaryresist"_prop);
    else mod *= target.props.number("mitigation"_prop, 1);
    if (rng.tenK() < miss) return 0;
    if (rng.tenK() < stats.number("spellcrit"_prop) * 100)
        mod *= 1 + .5 * (1 + critdmgbonus * 3);
    if (proc.coefficient) dmg += props.number("spelldamage"_prop) * proc.coefficient;
    return dmg * mod * stats.number("spelldmgmod"_prop, 1);
}

double PlayerState::physProc(double dmg) {
    double tmp = std::max(mh.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) dmg = 0;
    tmp += mh.dodge * 100;
    if (roll < tmp) dmg = 0;
    roll = rng.tenK();
    if (roll < (crit + mh.crit) * 100) dmg *= 1 + (1 + critdmgbonus * 2);
    return dmg * stats.number("dmgmod"_prop, 1) * mh.modifier;
}

double PlayerState::phantomProc(WeaponState& weapon) {
    if (!weapon.proc1) return 0;
    double dmg = 0;
    if (rng.tenK() < weapon.proc1->chance) {
        dmg += physProc(weapon.proc1->physicalDamage);
        if (dmg > 0) dmg += phantomProc(weapon);
    }
    if (weapon.proc2 && rng.tenK() < weapon.proc2->chance) {
        activateProcReference(*this, *weapon.proc2);
        if (weapon.proc2->magicDamage) dmg += magicProc(*weapon.proc2);
    }
    return dmg;
}

double PlayerState::procAttack(SpellState* ability, WeaponState& weapon, Result result,
                               int adjacent, double damageSoFar) {
    if (ability && ability->kind == SpellKind::ThunderClap) return 0;
    if (ability && ability->kind == SpellKind::ShieldSlam) {
        if (result != Result::Miss && result != Result::Dodge) {
            if (sodMode) if (auto* value = aura("defendersresolve"_action)) auraUse(*this, *value);
            if (weapon.windfuryAura != kNoRef && !auras[weapon.windfuryAura].timer && !damageSoFar && rng.tenK() < 2000)
                auraUse(*this, auras[weapon.windfuryAura]);
        }
        return 0;
    }
    double procDmg = 0;
    int extras = 0;
    int batched = 0;
    if (result != Result::Miss && result != Result::Dodge) {
        if (ability && ability->kind == SpellKind::Execute) {
            rage = 0;
            if (auto* sudden = aura("suddendeath"_action); sudden && sudden->timer) {
                rage = 10;
                auraRemove(*this, *sudden);
            }
        }
        if (ability && ability->kind == SpellKind::Slam && flag("slammainreset"_prop)) {
            if (auto* value = spell("mortalstrike"_action)) value->timer = 0;
            if (auto* value = spell("bloodthirst"_action)) value->timer = 0;
            if (auto* value = spell("shieldslam"_action)) value->timer = 0;
        }
        const auto weaponDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance) || (proc.gcd && timer && timer < 1500)) return;
            activateProcReference(*this, proc);
            if (proc.magicDamage)
                procDmg += proc.chance == 10000 ? proc.magicDamage : magicProc(proc);
            if (proc.physicalDamage) {
                double dmg = physProc(proc.physicalDamage);
                if (dmg > 0 && proc.phantom && !turtleMode) dmg += phantomProc(weapon);
                procDmg += dmg;
            }
        };
        const auto weaponExtraProc = [&](ProcState& proc) {
            if (damageSoFar || !(rng.tenK() < proc.chance) ||
                (proc.gcd && timer && timer < 1500)) return;
            if (ability) extraattacks += proc.extraCount;
            else extras = proc.extraCount;
        };
        const auto trinketDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance)) return;
            if (proc.magicDamage) procDmg += magicProc(proc);
            activateProcReference(*this, proc);
        };
        const auto trinketExtraProc = [&](ProcState& proc) {
            if (damageSoFar || !(rng.tenK() < proc.chance)) return;
            if (!proc.cooldown || !proc.useStep || step > proc.useStep) {
                if (proc.cooldown) proc.useStep = step + proc.cooldown;
                if (ability) batchedextras += proc.extraCount;
                else batched = proc.extraCount;
            }
        };
        const auto attackDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance)) return;
            if (proc.magicDamage)
                procDmg += proc.chance == 10000 ? proc.magicDamage : magicProc(proc);
            activateProcReference(*this, proc);
        };
        const auto attackExtraProc = [&](ProcState& proc) {
            if (damageSoFar || !(rng.tenK() < proc.chance)) return;
            if (ability) batchedextras += proc.extraCount;
            else batched = proc.extraCount;
        };

        for (const auto& entry : weapon.procPlan) {
            switch (entry.stage) {
            case ProcStage::WeaponProc1Damage:
                weaponDamageProc(*weapon.proc1);
                break;
            case ProcStage::WeaponProc1Extra:
                weaponExtraProc(*weapon.proc1);
                break;
            case ProcStage::WeaponProc2:
                if (rng.tenK() < weapon.proc2->chance) {
                    activateProcReference(*this, *weapon.proc2);
                    if (weapon.proc2->magicDamage) procDmg += magicProc(*weapon.proc2);
                }
                break;
            case ProcStage::TrinketProc1Damage:
                trinketDamageProc(*trinketproc1);
                break;
            case ProcStage::TrinketProc1Extra:
                trinketExtraProc(*trinketproc1);
                break;
            case ProcStage::TrinketProc2Damage:
                trinketDamageProc(*trinketproc2);
                break;
            case ProcStage::TrinketProc2Extra:
                trinketExtraProc(*trinketproc2);
                break;
            case ProcStage::AttackProc1Damage:
                if (attackproc1) attackDamageProc(*attackproc1);
                break;
            case ProcStage::AttackProc1Extra:
                if (attackproc1) attackExtraProc(*attackproc1);
                break;
            case ProcStage::AttackProc2Damage:
                if (attackproc2) attackDamageProc(*attackproc2);
                break;
            case ProcStage::AttackProc2Extra:
                if (attackproc2) attackExtraProc(*attackproc2);
                break;
            case ProcStage::SwordSpec:
                if (!damageSoFar && swordspecstep != step && rng.tenK() < entry.chance) {
                    swordspecstep = step;
                    ability ? ++extraattacks : ++extras;
                }
                break;
            case ProcStage::WailingExtra:
                if (!damageSoFar && wailingextrastep != step && rng.tenK() < 300) {
                    wailingextrastep = step;
                    ability ? ++extraattacks : ++extras;
                }
                break;
            case ProcStage::HakkariExtra:
                if (!damageSoFar && hakkariextrastep != step && rng.tenK() < 200) {
                    hakkariextrastep = step;
                    ability ? ++extraattacks : ++extras;
                }
                break;
            case ProcStage::TimewornExtra:
                if (!damageSoFar && timewornstep != step && rng.tenK() < entry.chance) {
                    timewornstep = step;
                    ability ? ++extraattacks : ++extras;
                }
                break;
            case ProcStage::ObsidianStrength:
            case ProcStage::ObsidianHaste:
                if (rng.tenK() < weapon.proc1->chance && !(timer && timer < 1500) &&
                    entry.action != kNoRef)
                    auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                break;
            case ProcStage::Bloodsurge:
                if (ability &&
                    (ability->kind == SpellKind::Whirlwind ||
                     ability->kind == SpellKind::Bloodthirst ||
                     ability->kind == SpellKind::HeroicStrike ||
                     ability->kind == SpellKind::QuickStrike) &&
                    rng.tenK() < 3000)
                    freeslam = true;
                break;
            case ProcStage::SwordAndBoard:
                if (ability && ability->kind == SpellKind::SunderArmor && rng.tenK() < 3000) {
                    freeshieldslam = true;
                    spells[static_cast<std::size_t>(entry.action)].timer = 0;
                }
                break;
            case ProcStage::VoodooFrenzy:
                if (rng.tenK() < 1500)
                    auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                break;
            case ProcStage::SuddenDeath:
                if (rng.tenK() < 1000)
                    auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                break;
            case ProcStage::FreshMeat:
                if (ability &&
                    (ability->kind == SpellKind::Bloodthirst ||
                     ability->kind == SpellKind::MortalStrike ||
                     ability->kind == SpellKind::ShieldSlam)) {
                    auto& value = auras[static_cast<std::size_t>(entry.action)];
                    if (value.firstuse || rng.tenK() < 1000) auraUse(*this, value);
                }
                break;
            case ProcStage::SingleMinded:
                if (!ability) auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                break;
            case ProcStage::Windfury: {
                auto& windfury = auras[static_cast<std::size_t>(entry.action)];
                if (!windfury.timer && !damageSoFar && rng.tenK() < 2000) {
                    if (!ability) extras = 0;
                    auraUse(*this, windfury);
                }
                break;
            }
            case ProcStage::Swarmguard: {
                auto& value = auras[static_cast<std::size_t>(entry.action)];
                if (value.timer && rng.tenK() < entry.chance) auraProc(*this, value);
                break;
            }
            case ProcStage::Zandalarian: {
                auto& value = auras[static_cast<std::size_t>(entry.action)];
                if (value.timer) auraProc(*this, value);
                break;
            }
            case ProcStage::PotentVenoms:
                if (rng.tenK() < entry.chance) {
                    if (!adjacent)
                        auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                    if (adjacent && ability && ability->kind == SpellKind::Cleave &&
                        entry.secondaryAction != kNoRef)
                        auraUse(*this, auras[static_cast<std::size_t>(entry.secondaryAction)]);
                }
                break;
            case ProcStage::RelentlessStrength: {
                auto& value = auras[static_cast<std::size_t>(entry.action)];
                if (value.timer) auraProc(*this, value);
                break;
            }
            case ProcStage::Shieldrender:
                if (!ability && rng.tenK() < entry.chance)
                    auraUse(*this, auras[static_cast<std::size_t>(entry.action)]);
                break;
            case ProcStage::Dragonbreath:
                if (rng.tenK() < 500) {
                    ProcState dragon;
                    dragon.props.set("magicdmg"_prop, 60);
                    dragon.props.set("coeff"_prop, 1);
                    dragon.loadScalars();
                    procDmg += magicProc(dragon);
                }
                break;
            }
        }
        extraattacks += extras;
        batchedextras += batched;
    }
    if (!ability) {
        if (configured.procTailFlurry != kNoRef) {
            auto& value = auras[static_cast<std::size_t>(configured.procTailFlurry)];
            if (value.stacks) auraProc(*this, value);
        }
        if (mh.windfuryAura != kNoRef && auras[mh.windfuryAura].stacks) auraProc(*this, auras[mh.windfuryAura]);
    }
    if (extraattacks > 0 && configured.procTailUnrelentingStrikes != kNoRef) {
        auto& value = auras[static_cast<std::size_t>(configured.procTailUnrelentingStrikes)];
        if (!value.timer) auraUse(*this, value);
    }
    return procDmg;
}

void PlayerState::switchStance(std::string_view value) {
    const std::string previous = stance;
    stance = std::string(value);
    if (auto* auraValue = aura("battlestance"_action)) auraValue->timer = 0;
    if (auto* auraValue = aura("berserkerstance"_action)) auraValue->timer = 0;
    if (auto* auraValue = aura("defensivestance"_action)) auraValue->timer = 0;
    if (auto* auraValue = aura("gladiatorstance"_action)) auraValue->timer = 0;
    const auto stanceKey = detail::stanceAuraAction(stance);
    if (auto* auraValue = stanceKey ? aura(*stanceKey) : aura(std::string_view{})) auraValue->timer = 1;
    rage = std::min(rage, talents.number("rageretained"_prop));
    const auto echoKey = detail::stanceEchoAction(previous);
    const std::string echoFallback = "echoes" + previous;
    if (auto* echo = echoKey ? aura(*echoKey) : aura(echoFallback)) auraUse(*this, *echo);
    const auto forecastKey = detail::stanceForecastAction(stance);
    const std::string forecastFallback = stance + "forecast";
    if (auto* forecast = forecastKey ? aura(*forecastKey) : aura(forecastFallback)) auraUse(*this, *forecast);
    props.set("ragemod"_prop, (base.number("ragemod"_prop) ? base.number("ragemod"_prop) : 1) *
        (stance == "glad" && !target.props.number("speed"_prop) ? 1.5 : 1));
    if (flag("switchrage"_prop)) ragetimer = 10;
    stancetimer = 1000;
    updateAuras();
}

bool PlayerState::isValidStance(std::string_view value, bool isRend) const {
    return stance == value || (stance == "glad" && flag("shield"_prop)) ||
        (value == "zerk" && active(*this, "echoeszerk"_action)) ||
        (value == "battle" && active(*this, "echoesbattle"_action)) ||
        (value == "def" && active(*this, "echoesdef"_action)) || active(*this, "echoesglad"_action) ||
        (isRend && stance == "zerk" && flag("bloodfrenzy"_prop));
}

bool PlayerState::isEnraged() const {
    constexpr detail::KnownAction keys[] = {"wreckingcrew"_action, "consumedrage"_action, "freshmeat"_action, "bloodrage"_action, "berserkerrage"_action};
    for (const auto key : keys) if (active(*this, key)) return true;
    return false;
}

} // namespace warriorsim

