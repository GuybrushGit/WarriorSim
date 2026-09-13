#pragma once

#include "property_ids.hpp"
#include "action_keys.hpp"

#include <array>
#include <bitset>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace warriorsim {

inline constexpr std::uint32_t kEngineVersion = 1;
inline constexpr int kNoRef = -1;

enum class Result : std::uint8_t { Hit = 0, Miss = 1, Dodge = 2, Crit = 3, Glance = 4 };
enum class School : std::uint8_t { None = 0, Physical = 1, Holy = 2, Fire = 4, Nature = 8,
                                  Frost = 16, Shadow = 32, Arcane = 64 };

enum class SpellKind : std::uint8_t {
    Spell, Bloodthirst, Whirlwind, Overpower, Execute, Bloodrage, HeroicStrike,
    Cleave, MortalStrike, SunderArmor, Hamstring, Pummel, ThunderClap,
    VictoryRush, RagingBlow, MasterStrike, BerserkerRage, QuickStrike,
    RagePotion, Slam, Fireball, GunAxe, BlademasterFury, ShieldSlam, Shockwave,
    TheMoltenCore, UnstoppableMight, StanceSwitch, GrilekFury
};

enum class AuraKind : std::uint8_t {
    Aura, TwowEnrageAura, Recklessness, Flurry, DeepWounds, OldDeepWounds,
    PotentVenoms, Crusader, Cloudkeeper, Felstriker, DeathWish, BattleStance,
    DefensiveStance, BerserkerStance, GladiatorStance, MightyRagePotion,
    QuicknessPotion, Bloodlust, Chastise, BloodFury, Berserking, Perception,
    Empyrean, Eskhandar, Tempest, Zeal, Annihilator, Rivenspike, Bonereaver,
    Destiny, Untamed, Champion, ZandalariVigil, ForgottenOrder,
    ElementiumChampion, Pummeler, Windfury, Swarmguard, Hategrips, Flask,
    Slayer, WorgenMark, Spider, Earthstrike, Gabbar, PrimalBlessing,
    PrimalBlessing2, TowerForgeSetBonus, BloodrageAura, Zandalarian, Avenger,
    BerserkerRageAura, BattleShout, ConsumedRage, Rend, Vibroblade, Ultrasonic,
    VoidMadness, WeaponBleed, Ragehammer, BlisteringRagehammer, Jackhammer,
    LordGeneral, Stoneslayer, CleaveArmor, StrengthChampion, MildlyIrradiated,
    GyromaticAcceleration, Spicy, GneuroLogical, CoinFlip, Rampage,
    WreckingCrew, SerpentAscension, VoodooFrenzy, RoarGuardian,
    RelentlessStrength, EchoesDread, FreshMeat, SuddenDeath, WarriorsResolve,
    EchoesBattle, EchoesZerk, EchoesDef, EchoesGlad, BattleForecast,
    ZerkForecast, DefForecast, GladForecast, DefendersResolve, MeltArmor,
    SingleMinded, DemonTaintedBlood, MoonstalkerFury, MagmadarsReturn,
    JujuFlurry, WrathWray, CrusaderZeal, GrilekGuard, ObsidianStrength,
    ObsidianHaste, Shieldrender, MoltenEmberstone, Modrag, UnrelentingStrikes
};

namespace detail {

// JavaScript's % operator and std::fmod have the same remainder semantics for
// the simulation values used here. Ordinary combat clocks are exact positive
// uint32 values, so handle that common case without a libm call. A zero dividend
// keeps its sign for a nonzero, non-NaN divisor. All other fractional, negative,
// non-finite, zero-divisor, and out-of-range inputs retain fmod.
inline double jsRemainder(double dividend, double divisor) noexcept {
    if (dividend == 0 && divisor != 0 && divisor == divisor) return dividend;
    constexpr double kUint32Limit = 4294967296.0;
    if (dividend > 0 && dividend < kUint32Limit &&
        divisor > 0 && divisor < kUint32Limit) {
        const auto integerDividend = static_cast<std::uint32_t>(dividend);
        const auto integerDivisor = static_cast<std::uint32_t>(divisor);
        if (integerDivisor != 0 &&
            static_cast<double>(integerDividend) == dividend &&
            static_cast<double>(integerDivisor) == divisor)
            return static_cast<double>(integerDividend % integerDivisor);
    }
    return std::fmod(dividend, divisor);
}

inline std::int32_t jsToInt32(double value) {
    if (value >= -2147483648.0 && value < 2147483648.0)
        return static_cast<std::int32_t>(value);
    if (!std::isfinite(value) || value == 0) return 0;
    double modulo = std::fmod(std::trunc(value), 4294967296.0);
    if (modulo < 0) modulo += 4294967296.0;
    return modulo < 2147483648.0
        ? static_cast<std::int32_t>(static_cast<std::uint32_t>(modulo))
        : static_cast<std::int32_t>(static_cast<std::int64_t>(modulo) - 4294967296ll);
}

struct TransparentStringHash {
    using is_transparent = void;
    std::size_t operator()(std::string_view value) const noexcept {
        return static_cast<std::size_t>(propertyHash(value));
    }
    std::size_t operator()(const std::string& value) const noexcept {
        return (*this)(std::string_view(value));
    }
    std::size_t operator()(const char* value) const noexcept {
        return (*this)(std::string_view(value));
    }
};

inline std::optional<KnownAction> stanceAuraAction(std::string_view stance) {
    if (stance == "battle") return "battlestance"_action;
    if (stance == "zerk") return "berserkerstance"_action;
    if (stance == "def") return "defensivestance"_action;
    if (stance == "glad") return "gladiatorstance"_action;
    return std::nullopt;
}

inline std::optional<KnownAction> stanceEchoAction(std::string_view stance) {
    if (stance == "battle") return "echoesbattle"_action;
    if (stance == "zerk") return "echoeszerk"_action;
    if (stance == "def") return "echoesdef"_action;
    if (stance == "glad") return "echoesglad"_action;
    return std::nullopt;
}

inline std::optional<KnownAction> stanceForecastAction(std::string_view stance) {
    if (stance == "battle") return "battleforecast"_action;
    if (stance == "zerk") return "zerkforecast"_action;
    if (stance == "def") return "defforecast"_action;
    if (stance == "glad") return "gladforecast"_action;
    return std::nullopt;
}

} // namespace detail

struct PropertyBag {
    using NumberMap = std::unordered_map<std::string, double,
        detail::TransparentStringHash, std::equal_to<>>;
    using StringMap = std::unordered_map<std::string, std::string,
        detail::TransparentStringHash, std::equal_to<>>;

    // Every scalar name referenced by native execution has a stable dense slot.
    // The maps retain unknown serialized properties for schema extensibility, but
    // literal hot-path reads compile to an array index and a presence-bit check.
    std::array<double, detail::kDensePropertyCount> denseNumbers{};
    std::bitset<detail::kDensePropertyCount> denseNumberPresent;
    std::bitset<detail::kDensePropertyCount> denseNumberFromString;
    std::bitset<detail::kDensePropertyCount> denseStringPresent;
    std::bitset<detail::kDensePropertyCount> denseStringTruthy;
    std::vector<std::uint16_t> denseNumberSlots;
    NumberMap numbers;
    StringMap strings;

    [[nodiscard]] bool has(std::string_view key) const;
    [[nodiscard]] double number(std::string_view key, double fallback = 0.0) const;
    [[nodiscard]] int integer(std::string_view key, int fallback = 0) const;
    [[nodiscard]] bool boolean(std::string_view key, bool fallback = false) const;
    [[nodiscard]] std::string string(std::string_view key, std::string fallback = {}) const;
    void set(std::string_view key, double value);
    void setString(std::string_view key, std::string value);
    void clearNumbers();

    [[nodiscard]] bool has(detail::KnownProperty key) const {
        const auto slot = static_cast<std::size_t>(key.index);
        return denseNumberPresent.test(slot) || denseStringPresent.test(slot);
    }
    [[nodiscard]] double number(detail::KnownProperty key, double fallback = 0.0) const {
        const auto slot = static_cast<std::size_t>(key.index);
        return denseNumberPresent.test(slot) ? denseNumbers[slot] : fallback;
    }
    [[nodiscard]] int integer(detail::KnownProperty key, int fallback = 0) const {
        return has(key) ? detail::jsToInt32(number(key, fallback)) : fallback;
    }
    [[nodiscard]] bool boolean(detail::KnownProperty key, bool fallback = false) const {
        const auto slot = static_cast<std::size_t>(key.index);
        if (denseNumberPresent.test(slot) && !denseNumberFromString.test(slot)) {
            const double value = denseNumbers[slot];
            return value != 0 && !std::isnan(value);
        }
        return denseStringPresent.test(slot) ? denseStringTruthy.test(slot) : fallback;
    }
    [[nodiscard]] std::string string(detail::KnownProperty key, std::string fallback = {}) const {
        const auto name = detail::kDensePropertyNames[static_cast<std::size_t>(key.index)];
        const auto it = strings.find(name);
        return it == strings.end() ? std::move(fallback) : it->second;
    }
    void set(detail::KnownProperty key, double value) {
        const auto slot = static_cast<std::size_t>(key.index);
        if (!denseNumberPresent.test(slot) || denseNumberFromString.test(slot))
            denseNumberSlots.push_back(static_cast<std::uint16_t>(slot));
        denseNumbers[slot] = value;
        denseNumberPresent.set(slot);
        denseNumberFromString.reset(slot);
    }
    void setString(detail::KnownProperty key, std::string value) {
        const auto slot = static_cast<std::size_t>(key.index);
        denseStringPresent.set(slot);
        denseStringTruthy.set(slot, !value.empty());
        if (!value.empty()) {
            char* end = nullptr;
            const double parsed = std::strtod(value.c_str(), &end);
            if (end != value.c_str() && *end == '\0') {
                denseNumbers[slot] = parsed;
                denseNumberPresent.set(slot);
                denseNumberFromString.set(slot);
            }
        }
        strings[std::string(detail::kDensePropertyNames[slot])] = std::move(value);
    }

    // Fixed execution names must be explicit compile-time IDs.  These deleted
    // exact-match overloads prevent a literal from silently choosing the
    // dynamic parser/configuration path.
    template<std::size_t N> bool has(const char (&)[N]) const = delete;
    template<std::size_t N> double number(const char (&)[N], double = 0.0) const = delete;
    template<std::size_t N> int integer(const char (&)[N], int = 0) const = delete;
    template<std::size_t N> bool boolean(const char (&)[N], bool = false) const = delete;
    template<std::size_t N> std::string string(const char (&)[N], std::string = {}) const = delete;
    template<std::size_t N> void set(const char (&)[N], double) = delete;
    template<std::size_t N> void setString(const char (&)[N], std::string) = delete;
};

struct Rng {
    std::uint32_t state = 0;
    void seed(std::uint32_t value) { state = value; }
    [[nodiscard]] std::uint32_t nextU32();
    [[nodiscard]] double next();
    [[nodiscard]] std::int32_t integer(double min, double max);
    [[nodiscard]] std::int32_t tenK();
};

struct ProcState {
    PropertyBag props;
    int spellAura = kNoRef;
    int spellSpell = kNoRef;
    double useStep = 0;
    double chance = 0;
    double extraValue = 0;
    double magicDamage = 0;
    double physicalDamage = 0;
    double cooldown = 0;
    double coefficient = 0;
    int extraCount = 0;
    bool gcd = false;
    bool phantom = false;
    bool binarySpell = false;

    void loadScalars();
};

enum class ProcStage : std::uint8_t {
    WeaponProc1Damage,
    WeaponProc1Extra,
    WeaponProc2,
    TrinketProc1Damage,
    TrinketProc1Extra,
    TrinketProc2Damage,
    TrinketProc2Extra,
    AttackProc1Damage,
    AttackProc1Extra,
    AttackProc2Damage,
    AttackProc2Extra,
    SwordSpec,
    WailingExtra,
    HakkariExtra,
    TimewornExtra,
    ObsidianStrength,
    ObsidianHaste,
    Bloodsurge,
    SwordAndBoard,
    VoodooFrenzy,
    SuddenDeath,
    FreshMeat,
    SingleMinded,
    Windfury,
    Swarmguard,
    Zandalarian,
    PotentVenoms,
    RelentlessStrength,
    Shieldrender,
    Dragonbreath,
};

struct ProcPlanEntry {
    ProcStage stage = ProcStage::WeaponProc1Damage;
    int action = kNoRef;
    int secondaryAction = kNoRef;
    double chance = 0;
};

struct WeaponState {
    PropertyBag props;
    std::optional<ProcState> proc1;
    std::optional<ProcState> proc2;
    int windfuryAura = kNoRef;
    std::vector<ProcPlanEntry> procPlan;
    double timer = 0;
    double mindmg = 0;
    double maxdmg = 0;
    double baseMindmg = 0;
    double baseMaxdmg = 0;
    double bonusdmg = 0;
    double baseBonusdmg = 0;
    double modifier = 1;
    double speed = 0;
    double normSpeed = 2.4;
    double crit = 0;
    double arp = 0;
    double glanceChance = 0;
    double miss = 0;
    double dwmiss = 0;
    double dodge = 0;
    double effectiveCrit = 0;
    double skill = 0;
    int id = 0;
    int type = 0;
    bool offhand = false;
    bool twohand = false;
    std::string name;
    double totaldmg = 0;
    double totalprocdmg = 0;
    std::array<std::uint64_t, 5> data{};

    void loadScalars();
};

struct SpellState {
    std::string key;
    SpellKind kind = SpellKind::Spell;
    PropertyBag props;
    int weapon = 0; // 0 = MH, 1 = OH
    double timer = 0;
    int stacks = 0;
    double maxdelay = 0;
    double executestep = 0;
    double useStep = std::numeric_limits<double>::quiet_NaN();
    bool firstuse = true;
    bool offhandhit = false;
    double totaldmg = 0;
    double idmg = 0;
    double usedrage = 0;
    double totalusedrage = 0;
    Result lastResult = Result::Hit;
    std::unique_ptr<SpellState> backupHeroic;
    std::array<std::uint64_t, 5> data{};
};

struct AuraState {
    std::string key;
    AuraKind kind = AuraKind::Aura;
    PropertyBag props;
    PropertyBag stats;
    PropertyBag multStats;
    double timer = 0;
    int stacks = 0;
    double starttimer = 0;
    double useStep = std::numeric_limits<double>::quiet_NaN();
    double maxdelay = 0;
    double mintime = 0;
    double cooldownTimer = 0;
    double nexttick = 0;
    int ticksleft = 0;
    double tfbstep = -6000;
    bool firstuse = true;
    double uptime = 0;
    double totaldmg = 0;
    double idmg = 0;
    double saveddmg = 0;
    std::vector<double> data;
};

struct TargetState {
    PropertyBag props;
    double armor = 0;
};

struct SimConfig {
    int timesecsmin = 60;
    int timesecsmax = 60;
    int executeperc = 20;
    double startrage = 0;
    int batching = 0;
};

struct BatchReport {
    std::uint32_t iterations = 0;
    double totaldmg = 0;
    double totalduration = 0;
    double mindps = std::numeric_limits<double>::infinity();
    double maxdps = 0;
    double sumdps = 0;
    double sumdps2 = 0;
    double starttime = 0;
    double endtime = 0;
    std::unordered_map<std::int32_t, std::uint32_t> spread;
};

struct CachedAuraAction {
    int index = kNoRef;
    bool requireFirstUse = false;
    bool skipWhenNoBleeds = false;
    bool requireAdjacent = false;
};

struct CachedPeriodicAura {
    int index = kNoRef;
    double interval = 0;
};

struct ConfiguredActionLists {
    int bloodrageSelection = kNoRef;
    int unstoppableMightSelection = kNoRef;
    int stanceSwitchSelection = kNoRef;
    int procTailFlurry = kNoRef;
    int procTailUnrelentingStrikes = kNoRef;
    std::vector<CachedAuraAction> stepAuras;
    std::vector<CachedAuraAction> endAuras;
    std::vector<int> noGcdAuras;
    std::vector<int> noGcdSpells;
    std::vector<int> moreNoGcdAuras;
    std::vector<int> onUseAuras;
    std::vector<int> queuedStrikes;
    std::vector<CachedPeriodicAura> periodicCandidates;
    std::vector<int> tickAuras;
    std::vector<int> weaponBleeds;
    std::vector<int> timedSpells;
    std::vector<int> absoluteAuras;
    std::vector<int> stepSpells;
    std::vector<int> periodicAuras;
    std::vector<int> finalAuras;
    std::vector<int> finalSpells;
};

struct PlayerState {
    using ActionMap = std::unordered_map<std::string, int,
        detail::TransparentStringHash, std::equal_to<>>;
    PropertyBag props;
    PropertyBag base;
    PropertyBag stats;
    PropertyBag talents;
    TargetState target;
    WeaponState mh;
    std::optional<WeaponState> oh;
    std::vector<SpellState> spells;
    std::vector<AuraState> auras;
    ActionMap spellByKey;
    ActionMap auraByKey;
    std::array<int, detail::kActionKeyCount> knownSpells = [] {
        std::array<int, detail::kActionKeyCount> values{};
        values.fill(kNoRef);
        return values;
    }();
    std::array<int, detail::kActionKeyCount> knownAuras = [] {
        std::array<int, detail::kActionKeyCount> values{};
        values.fill(kNoRef);
        return values;
    }();
    std::vector<std::pair<bool, int>> normalSpells; // first is aura
    std::vector<std::pair<bool, int>> executeSpells;
    std::vector<std::pair<bool, int>> prepOrder; // first is aura
    ConfiguredActionLists configured;
    std::optional<ProcState> trinketproc1;
    std::optional<ProcState> trinketproc2;
    std::optional<ProcState> attackproc1;
    std::optional<ProcState> attackproc2;

    Rng rng;
    double step = 0;
    double rage = 0;
    double timer = 0;
    double itemtimer = 0;
    double stancetimer = 0;
    double ragetimer = 0;
    double dodgetimer = 0;
    double crittimer = 0;
    double spelldelay = 0;
    double heroicdelay = 0;
    int extraattacks = 0;
    int batchedextras = 0;
    double swordspecstep = std::numeric_limits<double>::quiet_NaN();
    double wailingextrastep = std::numeric_limits<double>::quiet_NaN();
    double hakkariextrastep = std::numeric_limits<double>::quiet_NaN();
    double timewornstep = std::numeric_limits<double>::quiet_NaN();
    double critdmgbonus = 0;
    double mainspelldmg = 1;
    double armorReduction = 0;
    double arpContribution = 0;
    double crit = 0;
    bool nextswinghs = false;
    bool nextswingcl = false;
    bool freeslam = false;
    bool freeshieldslam = false;
    bool turtleMode = false;
    bool sodMode = false;
    std::string stance;

    [[nodiscard]] SpellState* spell(std::string_view key);
    [[nodiscard]] const SpellState* spell(std::string_view key) const;
    [[nodiscard]] AuraState* aura(std::string_view key);
    [[nodiscard]] const AuraState* aura(std::string_view key) const;
    [[nodiscard]] SpellState* spell(detail::KnownAction key) {
        if (key.index < 0) return nullptr;
        const int index = knownSpells[static_cast<std::size_t>(key.index)];
        return index == kNoRef ? nullptr : &spells[static_cast<std::size_t>(index)];
    }
    [[nodiscard]] const SpellState* spell(detail::KnownAction key) const {
        if (key.index < 0) return nullptr;
        const int index = knownSpells[static_cast<std::size_t>(key.index)];
        return index == kNoRef ? nullptr : &spells[static_cast<std::size_t>(index)];
    }
    [[nodiscard]] AuraState* aura(detail::KnownAction key) {
        if (key.index < 0) return nullptr;
        const int index = knownAuras[static_cast<std::size_t>(key.index)];
        return index == kNoRef ? nullptr : &auras[static_cast<std::size_t>(index)];
    }
    [[nodiscard]] const AuraState* aura(detail::KnownAction key) const {
        if (key.index < 0) return nullptr;
        const int index = knownAuras[static_cast<std::size_t>(key.index)];
        return index == kNoRef ? nullptr : &auras[static_cast<std::size_t>(index)];
    }
    template<std::size_t N> SpellState* spell(const char (&)[N]) = delete;
    template<std::size_t N> const SpellState* spell(const char (&)[N]) const = delete;
    template<std::size_t N> AuraState* aura(const char (&)[N]) = delete;
    template<std::size_t N> const AuraState* aura(const char (&)[N]) const = delete;
    [[nodiscard]] bool flag(std::string_view key) const { return props.boolean(key); }
    [[nodiscard]] double prop(std::string_view key, double fallback = 0) const { return props.number(key, fallback); }
    [[nodiscard]] bool flag(detail::KnownProperty key) const { return props.boolean(key); }
    [[nodiscard]] double prop(detail::KnownProperty key, double fallback = 0) const {
        return props.number(key, fallback);
    }
    template<std::size_t N> bool flag(const char (&)[N]) const = delete;
    template<std::size_t N> double prop(const char (&)[N], double = 0) const = delete;

    void buildConfiguredActionLists();
    void reset(double startingRage);
    void update();
    void updateAuras();
    void updateStrength();
    void updateAP();
    void updateHaste();
    void updateHasteDamage();
    void updateBonusDmg();
    void updateArmorReduction();
    void updateDmgMod();
    [[nodiscard]] double glanceReduction(const WeaponState& weapon);
    [[nodiscard]] double glanceChance(const WeaponState& weapon) const;
    [[nodiscard]] double missChance(const WeaponState& weapon) const;
    [[nodiscard]] double dwMissChance(const WeaponState& weapon) const;
    [[nodiscard]] double critChance() const;
    [[nodiscard]] double effectiveCrit(const WeaponState& weapon) const;
    [[nodiscard]] double dodgeChance(const WeaponState& weapon) const;
    [[nodiscard]] double getArmorReduction() const;
    [[nodiscard]] double getArpContribution() const;
    void addRage(double dmg, Result result, WeaponState& weapon, const SpellState* spell);
    void addRageMh(double dmg, Result result, WeaponState& weapon, const SpellState* spell);
    void addRageOh(double dmg, Result result, WeaponState& weapon, const SpellState* spell);
    bool stepTimer(double amount);
    bool stepItemTimer(double amount);
    bool stepStanceTimer(double amount);
    void stepRageTimer(double amount);
    void stepDodgeTimer(double amount);
    void stepAuras(bool noBleeds = false);
    void endAuras();
    [[nodiscard]] Result rollWeapon(WeaponState& weapon);
    [[nodiscard]] Result rollMeleeSpell(SpellState& spell, WeaponState& weapon);
    [[nodiscard]] Result rollMeleeAura(AuraState& aura, WeaponState& weapon);
    [[nodiscard]] Result rollMagicSpell(SpellState& spell);
    double attackMh(WeaponState& weapon, int adjacent = 0, double damageSoFar = 0);
    double attackOh(WeaponState& weapon);
    double cast(SpellState& spell, SpellState* delayedHeroic = nullptr, int adjacent = 0, double damageSoFar = 0);
    double castOh(SpellState& spell, int adjacent = 0, double damageSoFar = 0);
    double dealDamage(double dmg, Result result, WeaponState& weapon, SpellState* spell, bool adjacent);
    void procCrit(bool offhand, int adjacent, SpellState* spell);
    double procAttack(SpellState* spell, WeaponState& weapon, Result result, int adjacent, double damageSoFar);
    double phantomProc(WeaponState& weapon);
    double magicProc(const ProcState& proc);
    double physProc(double dmg);
    void switchStance(std::string_view value);
    [[nodiscard]] bool isValidStance(std::string_view value, bool isRend = false) const;
    [[nodiscard]] bool isEnraged() const;
};

// Spell behavior. All functions stay in native code during an iteration.
[[nodiscard]] bool spellCanUse(PlayerState&, SpellState&);
void spellUse(PlayerState&, SpellState&, SpellState* delayedHeroic = nullptr);
[[nodiscard]] double spellDamage(PlayerState&, SpellState&, WeaponState* weapon = nullptr);
[[nodiscard]] bool spellStep(PlayerState&, SpellState&, double amount);
void spellPrep(PlayerState&, SpellState&, int duration);

// Aura behavior. Implemented in auras.cpp; each concrete AuraKind either has
// its override or intentionally inherits the base implementation.
[[nodiscard]] bool auraCanUse(PlayerState&, AuraState&);
void auraUse(PlayerState&, AuraState&, bool prepull = false, int precounter = 0);
[[nodiscard]] bool auraStep(PlayerState&, AuraState&);
void auraEnd(PlayerState&, AuraState&);
void auraRemove(PlayerState&, AuraState&);
int auraPrep(PlayerState&, AuraState&, double duration, double itemdelay);
void auraProc(PlayerState&, AuraState&);

class Engine {
public:
    Engine(PlayerState player, SimConfig sim, std::uint32_t seed);
    BatchReport runBatch(std::uint32_t count, std::uint32_t globalIterationOffset,
                         bool fullReport);
    [[nodiscard]] std::string reportJson(const BatchReport&, bool fullReport) const;
    [[nodiscard]] std::uint32_t seed() const { return baseSeed_; }

private:
    double runOne(std::uint32_t globalIteration, double& duration);
    PlayerState player_;
    SimConfig sim_;
    std::uint32_t baseSeed_;
};

[[nodiscard]] SpellKind parseSpellKind(std::string_view value);
[[nodiscard]] AuraKind parseAuraKind(std::string_view value);
[[nodiscard]] const char* spellKindName(SpellKind value);
[[nodiscard]] const char* auraKindName(AuraKind value);

} // namespace warriorsim
