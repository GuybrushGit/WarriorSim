#include "engine.hpp"

#include <algorithm>
#include <chrono>
#include <climits>
#include <cmath>
#include <cstddef>
#include <cstdlib>
#include <iomanip>
#include <initializer_list>
#include <sstream>
#include <stdexcept>
#include <unordered_set>

#include <emscripten/bind.h>
#include <emscripten/val.h>

namespace warriorsim {
namespace {

using emscripten::val;

constexpr double kU32Scale = 1.0 / 4294967296.0;

std::string owned(std::string_view value) { return std::string(value); }

bool nullish(const val& value) { return value.isNull() || value.isUndefined(); }

val requireObject(const val& parent, const char* key) {
    val value = parent[key];
    if (nullish(value) || value.typeOf().as<std::string>() != "object") {
        throw std::runtime_error(std::string("missing object: ") + key);
    }
    return value;
}

std::string requireString(const val& parent, const char* key) {
    val value = parent[key];
    if (nullish(value) || value.typeOf().as<std::string>() != "string") {
        throw std::runtime_error(std::string("missing string: ") + key);
    }
    return value.as<std::string>();
}

double numberOr(const val& parent, const char* key, double fallback) {
    val value = parent[key];
    return nullish(value) ? fallback : value.as<double>();
}

PropertyBag readBag(const val& object) {
    PropertyBag result;
    if (nullish(object)) return result;
    val keys = val::global("Object").call<val>("keys", object);
    const auto length = keys["length"].as<unsigned>();
    for (unsigned i = 0; i < length; ++i) {
        const std::string key = keys[i].as<std::string>();
        val value = object[key];
        const std::string type = value.typeOf().as<std::string>();
        if (type == "number") result.set(key, value.as<double>());
        else if (type == "boolean") result.set(key, value.as<bool>() ? 1.0 : 0.0);
        else if (type == "string") result.setString(key, value.as<std::string>());
    }
    return result;
}

std::vector<std::string> readStringArray(const val& array) {
    std::vector<std::string> out;
    if (nullish(array)) return out;
    const auto length = array["length"].as<unsigned>();
    out.reserve(length);
    for (unsigned i = 0; i < length; ++i) out.push_back(array[i].as<std::string>());
    return out;
}

template<typename Map>
int resolve(const Map& map, const std::string& key, const char* context) {
    if (key.empty()) return kNoRef;
    const auto it = map.find(key);
    if (it == map.end()) throw std::runtime_error(std::string("dangling ") + context + ": " + key);
    return it->second;
}

ProcState readProc(const val& value, const PlayerState& player) {
    if (nullish(value)) throw std::runtime_error("internal: readProc called for null");
    ProcState result;
    result.props = readBag(value["props"]);
    result.useStep = result.props.number("usestep"_prop);
    result.loadScalars();
    val auraRef = value["spellAura"];
    if (!nullish(auraRef)) result.spellAura = resolve(player.auraByKey, auraRef.as<std::string>(), "proc aura");
    val spellRef = value["spellSpell"];
    if (!nullish(spellRef)) result.spellSpell = resolve(player.spellByKey, spellRef.as<std::string>(), "proc spell");
    return result;
}

void readWeapon(WeaponState& out, const val& value, const PlayerState& player) {
    out.props = readBag(requireObject(value, "props"));
    out.loadScalars();
    if (!nullish(value["proc1"])) out.proc1 = readProc(value["proc1"], player);
    if (!nullish(value["proc2"])) out.proc2 = readProc(value["proc2"], player);
    if (!nullish(value["windfuryAura"])) {
        out.windfuryAura = resolve(player.auraByKey, value["windfuryAura"].as<std::string>(),
                                   "weapon windfury aura");
    }
}

PlayerState readPlayer(const val& value) {
    PlayerState out;
    out.knownSpells.fill(kNoRef);
    out.knownAuras.fill(kNoRef);
    out.props = readBag(requireObject(value, "props"));
    out.base = readBag(requireObject(value, "base"));
    out.stats = readBag(requireObject(value, "stats"));
    out.talents = readBag(requireObject(value, "talents"));
    out.target.props = readBag(requireObject(value, "target"));
    out.target.armor = out.target.props.number("armor"_prop,
        out.target.props.number("basearmorbuffed"_prop, out.target.props.number("basearmor"_prop)));

    val spellArray = requireObject(value, "spells");
    const auto spellCount = spellArray["length"].as<unsigned>();
    out.spells.reserve(spellCount);
    for (unsigned i = 0; i < spellCount; ++i) {
        val item = spellArray[i];
        SpellState state;
        state.key = requireString(item, "key");
        if (out.spellByKey.contains(state.key)) throw std::runtime_error("duplicate spell key: " + state.key);
        state.kind = parseSpellKind(requireString(item, "kind"));
        state.props = readBag(requireObject(item, "props"));
        state.weapon = !nullish(item["weapon"]) && item["weapon"].as<std::string>() == "oh" ? 1 : 0;
        state.maxdelay = state.props.number("maxdelay"_prop);
        state.useStep = state.props.number("usestep"_prop, std::numeric_limits<double>::quiet_NaN());
        if (!nullish(item["backupHeroic"])) {
            val backup = item["backupHeroic"];
            state.backupHeroic = std::make_unique<SpellState>();
            state.backupHeroic->key = state.key + ":backupheroic";
            state.backupHeroic->kind = parseSpellKind(requireString(backup, "kind"));
            if (state.backupHeroic->kind != SpellKind::HeroicStrike)
                throw std::runtime_error("Cleave backupHeroic must be HeroicStrike");
            state.backupHeroic->props = readBag(requireObject(backup, "props"));
            state.backupHeroic->maxdelay = state.backupHeroic->props.number("maxdelay"_prop);
        }
        out.spellByKey.emplace(state.key, static_cast<int>(out.spells.size()));
        out.spells.push_back(std::move(state));
    }

    val auraArray = requireObject(value, "auras");
    const auto auraCount = auraArray["length"].as<unsigned>();
    out.auras.reserve(auraCount);
    for (unsigned i = 0; i < auraCount; ++i) {
        val item = auraArray[i];
        AuraState state;
        state.key = requireString(item, "key");
        if (out.auraByKey.contains(state.key)) throw std::runtime_error("duplicate aura key: " + state.key);
        state.kind = parseAuraKind(requireString(item, "kind"));
        state.props = readBag(requireObject(item, "props"));
        state.stats = readBag(item["stats"]);
        state.multStats = readBag(item["multStats"]);
        state.data.resize(static_cast<std::size_t>(std::max(0, state.props.integer("dataLength"_prop))), 0);
        state.useStep = state.props.number("usestep"_prop, std::numeric_limits<double>::quiet_NaN());
        state.tfbstep = state.props.number("tfbstep"_prop, -6000);
        out.auraByKey.emplace(state.key, static_cast<int>(out.auras.size()));
        out.auras.push_back(std::move(state));
    }

    const auto requireStance = [&](std::string_view key, AuraKind kind) {
        const auto it = out.auraByKey.find(owned(key));
        if (it == out.auraByKey.end())
            throw std::runtime_error("missing required stance aura: " + owned(key));
        if (out.auras[static_cast<std::size_t>(it->second)].kind != kind)
            throw std::runtime_error("invalid kind for stance aura: " + owned(key));
    };
    requireStance("battlestance", AuraKind::BattleStance);
    requireStance("berserkerstance", AuraKind::BerserkerStance);
    requireStance("defensivestance", AuraKind::DefensiveStance);
    requireStance("gladiatorstance", AuraKind::GladiatorStance);

    for (std::size_t i = 0; i < detail::kActionKeyCount; ++i) {
        const auto key = detail::kActionKeyNames[i];
        if (const auto spell = out.spellByKey.find(key); spell != out.spellByKey.end())
            out.knownSpells[i] = spell->second;
        if (const auto aura = out.auraByKey.find(key); aura != out.auraByKey.end())
            out.knownAuras[i] = aura->second;
    }

    val weapons = requireObject(value, "weapons");
    readWeapon(out.mh, requireObject(weapons, "mh"), out);
    if (!nullish(weapons["oh"])) {
        out.oh.emplace();
        readWeapon(*out.oh, weapons["oh"], out);
    }

    val links = requireObject(value, "links");
    auto readActions = [&](const val& array, std::vector<std::pair<bool, int>>& destination,
                           const char* context) {
        if (nullish(array)) return;
        const auto count = array["length"].as<unsigned>();
        destination.reserve(count);
        for (unsigned i = 0; i < count; ++i) {
            const std::string type = requireString(array[i], "type");
            if (type != "aura" && type != "spell")
                throw std::runtime_error(std::string("invalid action type in ") + context + ": " + type);
            const bool isAura = type == "aura";
            const std::string key = requireString(array[i], "key");
            destination.emplace_back(isAura,
                resolve(isAura ? out.auraByKey : out.spellByKey, key, context));
        }
    };
    readActions(links["normalSpells"], out.normalSpells, "normal action");
    readActions(links["executeSpells"], out.executeSpells, "execute action");
    val prep = links["prepOrder"];
    if (!nullish(prep)) {
        const auto count = prep["length"].as<unsigned>();
        out.prepOrder.reserve(count);
        for (unsigned i = 0; i < count; ++i) {
            const std::string type = requireString(prep[i], "type");
            if (type != "aura" && type != "spell")
                throw std::runtime_error("invalid action type in prep order: " + type);
            const bool isAura = type == "aura";
            const std::string key = requireString(prep[i], "key");
            out.prepOrder.emplace_back(isAura,
                resolve(isAura ? out.auraByKey : out.spellByKey, key, "prep order"));
        }
    }

    val procs = value["procs"];
    if (!nullish(procs)) {
        if (!nullish(procs["trinketproc1"])) out.trinketproc1 = readProc(procs["trinketproc1"], out);
        if (!nullish(procs["trinketproc2"])) out.trinketproc2 = readProc(procs["trinketproc2"], out);
        if (!nullish(procs["attackproc1"])) out.attackproc1 = readProc(procs["attackproc1"], out);
        if (!nullish(procs["attackproc2"])) out.attackproc2 = readProc(procs["attackproc2"], out);
    }

    out.rage = out.props.number("rage"_prop);
    const auto mode = out.props.string("mode"_prop);
    if (mode != "classic" && mode != "sod") throw std::runtime_error("unsupported game mode: " + mode);
    out.turtleMode = false;
    out.sodMode = out.props.string("mode"_prop) == "sod";
    out.stance = out.props.string("stance"_prop, out.props.string("basestance"_prop, "battle"));
    out.critdmgbonus = out.props.number("critdmgbonus"_prop);
    out.mainspelldmg = out.props.number("mainspelldmg"_prop, 1);
    out.crit = out.props.number("crit"_prop);
    out.armorReduction = out.props.number("armorReduction"_prop);
    out.arpContribution = out.props.number("arpContribution"_prop);
    out.buildConfiguredActionLists();
    return out;
}

SimConfig readSim(const val& value) {
    SimConfig out;
    auto readInt = [&](const char* key, int fallback) {
        const double input = numberOr(value, key, fallback);
        if (!std::isfinite(input) || input < INT_MIN || input > INT_MAX)
            throw std::runtime_error(std::string("invalid numeric simulation option: ") + key);
        return static_cast<int>(input);
    };
    out.timesecsmin = readInt("timesecsmin", 60);
    out.timesecsmax = readInt("timesecsmax", 60);
    out.executeperc = readInt("executeperc", 20);
    out.startrage = numberOr(value, "startrage", 0);
    out.batching = readInt("batching", 0);
    if (out.timesecsmin < 0 || out.timesecsmax < out.timesecsmin ||
        !std::isfinite(out.startrage))
        throw std::runtime_error("invalid simulation duration range");
    return out;
}

std::string jsonEscape(std::string_view input) {
    std::ostringstream out;
    for (const unsigned char c : input) {
        switch (c) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (c < 0x20) out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << int(c) << std::dec;
                else out << c;
        }
    }
    return out.str();
}

void jsonNumber(std::ostringstream& out, double value) {
    if (std::isfinite(value)) out << std::setprecision(17) << value;
    else out << "null";
}

std::unordered_map<std::uint32_t, std::unique_ptr<Engine>> engines;
std::uint32_t nextHandle = 1;

std::uint32_t checkedUint32(double value, const char* name) {
    if (!std::isfinite(value) || value < 0 || value > 4294967295.0 || std::trunc(value) != value)
        throw std::runtime_error(std::string("invalid unsigned 32-bit integer: ") + name);
    return static_cast<std::uint32_t>(value);
}

std::uint32_t createEngineBinding(const std::string& specJson, double seedValue) {
    val root = val::global("JSON").call<val>("parse", specJson);
    const double versionValue = numberOr(root, "version", 0);
    if (!std::isfinite(versionValue) || versionValue < 0 || versionValue > UINT_MAX ||
        std::trunc(versionValue) != versionValue)
        throw std::runtime_error("invalid execution spec version");
    const auto version = static_cast<unsigned>(versionValue);
    if (version != kEngineVersion) throw std::runtime_error("unsupported execution spec version: " + std::to_string(version));
    PlayerState player = readPlayer(requireObject(root, "player"));
    SimConfig sim = readSim(requireObject(root, "sim"));
    const std::uint32_t seed = checkedUint32(seedValue, "seed");
    const std::uint32_t handle = nextHandle++;
    engines.emplace(handle, std::make_unique<Engine>(std::move(player), sim, seed));
    return handle;
}

std::string runBatchBinding(double handleValue, double countValue,
                            double globalIterationOffsetValue, bool fullReport) {
    const std::uint32_t handle = checkedUint32(handleValue, "handle");
    const std::uint32_t count = checkedUint32(countValue, "count");
    const std::uint32_t globalIterationOffset = checkedUint32(
        globalIterationOffsetValue, "globalIterationOffset");
    if (globalIterationOffsetValue + countValue > 4294967296.0)
        throw std::runtime_error("iteration range exceeds unsigned 32-bit space");
    const auto it = engines.find(handle);
    if (it == engines.end()) throw std::runtime_error("invalid or destroyed engine handle");
    const auto report = it->second->runBatch(count, globalIterationOffset, fullReport);
    return it->second->reportJson(report, fullReport);
}

void destroyEngineBinding(double handleValue) {
    const std::uint32_t handle = checkedUint32(handleValue, "handle");
    if (engines.erase(handle) != 1) throw std::runtime_error("invalid or destroyed engine handle");
}

} // namespace

bool PropertyBag::has(std::string_view key) const {
    const int index = detail::propertyIndex(key);
    if (index >= 0) {
        const auto slot = static_cast<std::size_t>(index);
        return denseNumberPresent.test(slot) || denseStringPresent.test(slot);
    }
    return numbers.contains(key) || strings.contains(key);
}

double PropertyBag::number(std::string_view key, double fallback) const {
    const int index = detail::propertyIndex(key);
    if (index >= 0) {
        const auto slot = static_cast<std::size_t>(index);
        return denseNumberPresent.test(slot) ? denseNumbers[slot] : fallback;
    }
    const auto it = numbers.find(key);
    if (it != numbers.end()) return it->second;
    const auto text = strings.find(key);
    if (text == strings.end() || text->second.empty()) return fallback;
    char* end = nullptr;
    const double parsed = std::strtod(text->second.c_str(), &end);
    return end != text->second.c_str() && *end == '\0' ? parsed : fallback;
}

int PropertyBag::integer(std::string_view key, int fallback) const {
    if (!has(key)) return fallback;
    return detail::jsToInt32(number(key, fallback));
}

bool PropertyBag::boolean(std::string_view key, bool fallback) const {
    const int index = detail::propertyIndex(key);
    if (index >= 0) {
        const auto slot = static_cast<std::size_t>(index);
        if (denseNumberPresent.test(slot) && !denseNumberFromString.test(slot)) {
            const double value = denseNumbers[slot];
            return value != 0 && !std::isnan(value);
        }
        if (denseStringPresent.test(slot)) return denseStringTruthy.test(slot);
        return fallback;
    }
    const auto it = numbers.find(key);
    if (it != numbers.end()) return it->second != 0 && !std::isnan(it->second);
    const auto text = strings.find(key);
    return text == strings.end() ? fallback : !text->second.empty();
}

std::string PropertyBag::string(std::string_view key, std::string fallback) const {
    const auto it = strings.find(key);
    return it == strings.end() ? std::move(fallback) : it->second;
}

void PropertyBag::set(std::string_view key, double value) {
    const int index = detail::propertyIndex(key);
    if (index >= 0) {
        const auto slot = static_cast<std::size_t>(index);
        if (!denseNumberPresent.test(slot) || denseNumberFromString.test(slot))
            denseNumberSlots.push_back(static_cast<std::uint16_t>(slot));
        denseNumbers[slot] = value;
        denseNumberPresent.set(slot);
        denseNumberFromString.reset(slot);
        return;
    }
    numbers[owned(key)] = value;
}

void PropertyBag::setString(std::string_view key, std::string value) {
    const int index = detail::propertyIndex(key);
    if (index >= 0) {
        const auto slot = static_cast<std::size_t>(index);
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
    }
    strings[owned(key)] = std::move(value);
}

void PropertyBag::clearNumbers() {
    denseNumberPresent &= denseNumberFromString;
    denseNumberSlots.clear();
    numbers.clear();
}

std::uint32_t Rng::nextU32() {
    state += 0x6d2b79f5u;
    std::uint32_t z = state;
    z = (z ^ (z >> 15u)) * (z | 1u);
    z ^= z + ((z ^ (z >> 7u)) * (z | 61u));
    return z ^ (z >> 14u);
}

double Rng::next() { return static_cast<double>(nextU32()) * kU32Scale; }

std::int32_t Rng::integer(double min, double max) {
    const double value = next() * (max - min + 1.0) + min;
    return detail::jsToInt32(value);
}

std::int32_t Rng::tenK() { return static_cast<std::int32_t>(next() * 10000.0); }

void ProcState::loadScalars() {
    chance = props.number("chance"_prop);
    extraValue = props.number("extra"_prop);
    magicDamage = props.number("magicdmg"_prop);
    physicalDamage = props.number("physdmg"_prop);
    cooldown = props.number("cooldown"_prop);
    coefficient = props.number("coeff"_prop);
    extraCount = props.integer("extra"_prop);
    gcd = props.boolean("gcd"_prop);
    phantom = props.boolean("phantom"_prop);
    binarySpell = props.boolean("binaryspell"_prop);
}

void WeaponState::loadScalars() {
    id = props.integer("id"_prop);
    name = props.string("name"_prop);
    mindmg = props.number("mindmg"_prop);
    maxdmg = props.number("maxdmg"_prop);
    baseMindmg = props.number("basemindmg"_prop, mindmg);
    baseMaxdmg = props.number("basemaxdmg"_prop, maxdmg);
    bonusdmg = props.number("bonusdmg"_prop);
    baseBonusdmg = props.number("basebonusdmg"_prop, bonusdmg);
    modifier = props.number("modifier"_prop, 1);
    speed = props.number("speed"_prop);
    normSpeed = props.number("normSpeed"_prop, 2.4);
    crit = props.number("crit"_prop);
    arp = props.number("arp"_prop);
    type = props.integer("type"_prop);
    offhand = props.boolean("offhand"_prop);
    twohand = props.boolean("twohand"_prop);
    timer = props.number("timer"_prop);
}

SpellKind parseSpellKind(std::string_view value) {
#define SPELL_KIND(name) if (value == #name) return SpellKind::name
    SPELL_KIND(Spell); SPELL_KIND(Bloodthirst); SPELL_KIND(Whirlwind); SPELL_KIND(Overpower);
    SPELL_KIND(Execute); SPELL_KIND(Bloodrage); SPELL_KIND(HeroicStrike); SPELL_KIND(Cleave);
    SPELL_KIND(MortalStrike); SPELL_KIND(SunderArmor); SPELL_KIND(Hamstring); SPELL_KIND(Pummel);
    SPELL_KIND(ThunderClap); SPELL_KIND(VictoryRush); SPELL_KIND(RagingBlow); SPELL_KIND(MasterStrike);
    SPELL_KIND(BerserkerRage); SPELL_KIND(QuickStrike); SPELL_KIND(RagePotion); SPELL_KIND(Slam);
    SPELL_KIND(Fireball); SPELL_KIND(GunAxe); SPELL_KIND(BlademasterFury); SPELL_KIND(ShieldSlam);
    SPELL_KIND(Shockwave); SPELL_KIND(TheMoltenCore); SPELL_KIND(UnstoppableMight);
    SPELL_KIND(StanceSwitch); SPELL_KIND(GrilekFury);
#undef SPELL_KIND
    throw std::runtime_error("unsupported spell kind: " + owned(value));
}

AuraKind parseAuraKind(std::string_view value) {
#define AURA_KIND(name) if (value == #name) return AuraKind::name
    AURA_KIND(Aura); AURA_KIND(TwowEnrageAura); AURA_KIND(Recklessness); AURA_KIND(Flurry);
    AURA_KIND(DeepWounds); AURA_KIND(OldDeepWounds); AURA_KIND(PotentVenoms); AURA_KIND(Crusader);
    AURA_KIND(Cloudkeeper); AURA_KIND(Felstriker); AURA_KIND(DeathWish); AURA_KIND(BattleStance);
    AURA_KIND(DefensiveStance); AURA_KIND(BerserkerStance); AURA_KIND(GladiatorStance);
    AURA_KIND(MightyRagePotion); AURA_KIND(QuicknessPotion); AURA_KIND(Bloodlust);
    AURA_KIND(Chastise); AURA_KIND(BloodFury); AURA_KIND(Berserking); AURA_KIND(Perception);
    AURA_KIND(Empyrean); AURA_KIND(Eskhandar); AURA_KIND(Tempest); AURA_KIND(Zeal);
    AURA_KIND(Annihilator); AURA_KIND(Rivenspike); AURA_KIND(Bonereaver); AURA_KIND(Destiny);
    AURA_KIND(Untamed); AURA_KIND(Champion); AURA_KIND(ZandalariVigil); AURA_KIND(ForgottenOrder);
    AURA_KIND(ElementiumChampion); AURA_KIND(Pummeler); AURA_KIND(Windfury); AURA_KIND(Swarmguard);
    AURA_KIND(Hategrips); AURA_KIND(Flask); AURA_KIND(Slayer); AURA_KIND(WorgenMark);
    AURA_KIND(Spider); AURA_KIND(Earthstrike); AURA_KIND(Gabbar); AURA_KIND(PrimalBlessing);
    AURA_KIND(PrimalBlessing2); AURA_KIND(TowerForgeSetBonus); AURA_KIND(BloodrageAura);
    AURA_KIND(Zandalarian); AURA_KIND(Avenger); AURA_KIND(BerserkerRageAura);
    AURA_KIND(BattleShout); AURA_KIND(ConsumedRage); AURA_KIND(Rend); AURA_KIND(Vibroblade);
    AURA_KIND(Ultrasonic); AURA_KIND(VoidMadness); AURA_KIND(WeaponBleed); AURA_KIND(Ragehammer);
    AURA_KIND(BlisteringRagehammer); AURA_KIND(Jackhammer); AURA_KIND(LordGeneral);
    AURA_KIND(Stoneslayer); AURA_KIND(CleaveArmor); AURA_KIND(StrengthChampion);
    AURA_KIND(MildlyIrradiated); AURA_KIND(GyromaticAcceleration); AURA_KIND(Spicy);
    AURA_KIND(GneuroLogical); AURA_KIND(CoinFlip); AURA_KIND(Rampage); AURA_KIND(WreckingCrew);
    AURA_KIND(SerpentAscension); AURA_KIND(VoodooFrenzy); AURA_KIND(RoarGuardian);
    AURA_KIND(RelentlessStrength); AURA_KIND(EchoesDread); AURA_KIND(FreshMeat);
    AURA_KIND(SuddenDeath); AURA_KIND(WarriorsResolve); AURA_KIND(EchoesBattle);
    AURA_KIND(EchoesZerk); AURA_KIND(EchoesDef); AURA_KIND(EchoesGlad);
    AURA_KIND(BattleForecast); AURA_KIND(ZerkForecast); AURA_KIND(DefForecast);
    AURA_KIND(GladForecast); AURA_KIND(DefendersResolve); AURA_KIND(MeltArmor);
    AURA_KIND(SingleMinded); AURA_KIND(DemonTaintedBlood); AURA_KIND(MoonstalkerFury);
    AURA_KIND(MagmadarsReturn); AURA_KIND(JujuFlurry); AURA_KIND(WrathWray);
    AURA_KIND(CrusaderZeal); AURA_KIND(GrilekGuard); AURA_KIND(ObsidianStrength);
    AURA_KIND(ObsidianHaste); AURA_KIND(Shieldrender); AURA_KIND(MoltenEmberstone);
    AURA_KIND(Modrag); AURA_KIND(UnrelentingStrikes);
#undef AURA_KIND
    throw std::runtime_error("unsupported aura kind: " + owned(value));
}

const char* spellKindName(SpellKind kind) {
    switch (kind) {
#define CASE(name) case SpellKind::name: return #name
        CASE(Spell); CASE(Bloodthirst); CASE(Whirlwind); CASE(Overpower); CASE(Execute);
        CASE(Bloodrage); CASE(HeroicStrike); CASE(Cleave); CASE(MortalStrike);
        CASE(SunderArmor); CASE(Hamstring); CASE(Pummel); CASE(ThunderClap);
        CASE(VictoryRush); CASE(RagingBlow); CASE(MasterStrike); CASE(BerserkerRage);
        CASE(QuickStrike); CASE(RagePotion); CASE(Slam); CASE(Fireball); CASE(GunAxe);
        CASE(BlademasterFury); CASE(ShieldSlam); CASE(Shockwave); CASE(TheMoltenCore);
        CASE(UnstoppableMight); CASE(StanceSwitch); CASE(GrilekFury);
#undef CASE
    }
    return "Unknown";
}

const char* auraKindName(AuraKind kind) {
    // Used for diagnostics/reporting only; the configured key remains the report id.
    switch (kind) {
        case AuraKind::Aura: return "Aura";
        case AuraKind::Flurry: return "Flurry";
        case AuraKind::DeepWounds: return "DeepWounds";
        case AuraKind::OldDeepWounds: return "OldDeepWounds";
        case AuraKind::Rend: return "Rend";
        default: return "AuraSubclass";
    }
}

SpellState* PlayerState::spell(std::string_view key) {
    const int id = detail::actionKeyIndex(key);
    if (id >= 0) {
        const int index = knownSpells[static_cast<std::size_t>(id)];
        return index == kNoRef ? nullptr : &spells[static_cast<std::size_t>(index)];
    }
    const auto it = spellByKey.find(key);
    return it == spellByKey.end() ? nullptr : &spells[static_cast<std::size_t>(it->second)];
}
const SpellState* PlayerState::spell(std::string_view key) const {
    const int id = detail::actionKeyIndex(key);
    if (id >= 0) {
        const int index = knownSpells[static_cast<std::size_t>(id)];
        return index == kNoRef ? nullptr : &spells[static_cast<std::size_t>(index)];
    }
    const auto it = spellByKey.find(key);
    return it == spellByKey.end() ? nullptr : &spells[static_cast<std::size_t>(it->second)];
}
AuraState* PlayerState::aura(std::string_view key) {
    const int id = detail::actionKeyIndex(key);
    if (id >= 0) {
        const int index = knownAuras[static_cast<std::size_t>(id)];
        return index == kNoRef ? nullptr : &auras[static_cast<std::size_t>(index)];
    }
    const auto it = auraByKey.find(key);
    return it == auraByKey.end() ? nullptr : &auras[static_cast<std::size_t>(it->second)];
}
const AuraState* PlayerState::aura(std::string_view key) const {
    const int id = detail::actionKeyIndex(key);
    if (id >= 0) {
        const int index = knownAuras[static_cast<std::size_t>(id)];
        return index == kNoRef ? nullptr : &auras[static_cast<std::size_t>(index)];
    }
    const auto it = auraByKey.find(key);
    return it == auraByKey.end() ? nullptr : &auras[static_cast<std::size_t>(it->second)];
}

void PlayerState::buildConfiguredActionLists() {
    configured = {};

    const auto auraIndex = [this](detail::KnownAction key) {
        return knownAuras[static_cast<std::size_t>(key.index)];
    };
    const auto spellIndex = [this](detail::KnownAction key) {
        return knownSpells[static_cast<std::size_t>(key.index)];
    };
    const auto addAura = [&](std::vector<int>& destination, detail::KnownAction key) {
        const int index = auraIndex(key);
        if (index != kNoRef) destination.push_back(index);
    };
    const auto addSpell = [&](std::vector<int>& destination, detail::KnownAction key) {
        const int index = spellIndex(key);
        if (index != kNoRef) destination.push_back(index);
    };
    const auto addAuras = [&](std::vector<int>& destination,
                              std::initializer_list<detail::KnownAction> keys) {
        for (const auto key : keys) addAura(destination, key);
    };
    const auto addSpells = [&](std::vector<int>& destination,
                               std::initializer_list<detail::KnownAction> keys) {
        for (const auto key : keys) addSpell(destination, key);
    };
    const auto addOrderedAura = [&](std::vector<CachedAuraAction>& destination, int index,
                                    bool firstUse = false, bool skipWhenNoBleeds = false,
                                    bool requireAdjacent = false) {
        if (index != kNoRef)
            destination.push_back({index, firstUse, skipWhenNoBleeds, requireAdjacent});
    };
    const auto addOrderedKey = [&](std::vector<CachedAuraAction>& destination,
                                   detail::KnownAction key, bool firstUse = false,
                                   bool skipWhenNoBleeds = false, bool requireAdjacent = false) {
        addOrderedAura(destination, auraIndex(key), firstUse, skipWhenNoBleeds,
                       requireAdjacent);
    };
    const auto addOrderedProc = [&](std::vector<CachedAuraAction>& destination,
                                    const std::optional<ProcState>& proc) {
        if (proc) addOrderedAura(destination, proc->spellAura);
    };

    configured.bloodrageSelection = spellIndex("bloodrage"_action);
    configured.unstoppableMightSelection = spellIndex("unstoppablemight"_action);
    if (configured.unstoppableMightSelection != kNoRef &&
        spells[static_cast<std::size_t>(configured.unstoppableMightSelection)].kind ==
            SpellKind::UnstoppableMight &&
        auraIndex("echoesbattle"_action) == kNoRef)
        configured.unstoppableMightSelection = kNoRef;
    configured.stanceSwitchSelection = spellIndex("stanceswitch"_action);
    if (configured.stanceSwitchSelection != kNoRef &&
        spells[static_cast<std::size_t>(configured.stanceSwitchSelection)].kind ==
            SpellKind::StanceSwitch &&
        spellIndex("unstoppablemight"_action) != kNoRef)
        configured.stanceSwitchSelection = kNoRef;

    addOrderedProc(configured.stepAuras, mh.proc1);
    addOrderedProc(configured.stepAuras, mh.proc2);
    if (oh) {
        addOrderedProc(configured.stepAuras, oh->proc1);
        addOrderedProc(configured.stepAuras, oh->proc2);
    }
    constexpr std::pair<detail::KnownAction, bool> stepNamed[] = {
        {"mightyragepotion"_action, true}, {"mildlyirradiated"_action, true}, {"recklessness"_action, true}, {"deathwish"_action, true},
        {"cloudkeeper"_action, true}, {"voidmadness"_action, true}, {"gyromaticacceleration"_action, true},
        {"gneurological"_action, true}, {"coinflip"_action, false}, {"flask"_action, true},
        {"bloodfury"_action, true}, {"berserking"_action, true}, {"slayer"_action, true},
        {"spider"_action, true}, {"earthstrike"_action, true}, {"roarguardian"_action, true},
        {"pummeler"_action, true}, {"swarmguard"_action, true}, {"zandalarian"_action, true},
        {"relentlessstrength"_action, true}, {"rampage"_action, false}, {"wreckingcrew"_action, false},
        {"freshmeat"_action, false}, {"suddendeath"_action, false}, {"voodoofrenzy"_action, false},
        {"battleshout"_action, false}, {"echoeszerk"_action, false}, {"echoesbattle"_action, false},
        {"echoesdef"_action, false}, {"echoesglad"_action, false}, {"battleforecast"_action, false},
        {"zerkforecast"_action, false}, {"defforecast"_action, false}, {"gladforecast"_action, false},
        {"defendersresolve"_action, false}, {"singleminded"_action, false}, {"demontaintedblood"_action, false},
        {"wrathwray"_action, false}, {"moonstalkerfury"_action, false}, {"jujuflurry"_action, false},
        {"grilekguard"_action, false}, {"obsidianhaste"_action, false},
        {"obsidianstrength"_action, false}, };
    for (const auto& [key, firstUse] : stepNamed)
        addOrderedKey(configured.stepAuras, key, firstUse);
    addOrderedAura(configured.stepAuras, mh.windfuryAura);
    addOrderedProc(configured.stepAuras, trinketproc1);
    addOrderedProc(configured.stepAuras, trinketproc2);
    addOrderedProc(configured.stepAuras, attackproc1);
    addOrderedProc(configured.stepAuras, attackproc2);

    addOrderedKey(configured.stepAuras, "deepwounds"_action, false, true);
    addOrderedKey(configured.stepAuras, "rend"_action, false, true);
    addOrderedKey(configured.stepAuras, "berserkerrage"_action);
    addOrderedKey(configured.stepAuras, "consumedrage"_action);
    addOrderedKey(configured.stepAuras, "weaponbleedmh"_action);
    addOrderedKey(configured.stepAuras, "weaponbleedoh"_action);
    addOrderedKey(configured.stepAuras, "deepwounds2"_action, false, true, true);
    addOrderedKey(configured.stepAuras, "deepwounds3"_action, false, true, true);
    addOrderedKey(configured.stepAuras, "deepwounds4"_action, false, true, true);


    addOrderedProc(configured.endAuras, mh.proc1);
    addOrderedProc(configured.endAuras, mh.proc2);
    if (oh) {
        addOrderedProc(configured.endAuras, oh->proc1);
        addOrderedProc(configured.endAuras, oh->proc2);
    }
    constexpr std::pair<detail::KnownAction, bool> endNamed[] = {
        {"mightyragepotion"_action, true}, {"mildlyirradiated"_action, true}, {"recklessness"_action, true}, {"deathwish"_action, true},
        {"cloudkeeper"_action, true}, {"voidmadness"_action, true}, {"gyromaticacceleration"_action, true},
        {"gneurological"_action, true}, {"coinflip"_action, false}, {"flask"_action, true},
        {"bloodfury"_action, true}, {"berserking"_action, true}, {"slayer"_action, true},
        {"spider"_action, true}, {"gabbar"_action, true}, {"earthstrike"_action, true}, {"roarguardian"_action, true}, {"pummeler"_action, true}, {"swarmguard"_action, true},
        {"zandalarian"_action, true}, {"relentlessstrength"_action, true}, {"rampage"_action, false},
        {"wreckingcrew"_action, false}, {"freshmeat"_action, false}, {"suddendeath"_action, false},
        {"voodoofrenzy"_action, false}, {"battleshout"_action, false}, {"echoeszerk"_action, false},
        {"echoesbattle"_action, false}, {"echoesdef"_action, false}, {"echoesglad"_action, false},
        {"battleforecast"_action, false}, {"zerkforecast"_action, false}, {"defforecast"_action, false},
        {"gladforecast"_action, false}, {"defendersresolve"_action, false}, {"singleminded"_action, false},
        {"moonstalkerfury"_action, false}, {"demontaintedblood"_action, false}, {"wrathwray"_action, false},
        {"jujuflurry"_action, false}, {"grilekguard"_action, false},
        {"obsidianhaste"_action, false}, {"obsidianstrength"_action, false}, };
    for (const auto& [key, firstUse] : endNamed)
        addOrderedKey(configured.endAuras, key, firstUse);
    addOrderedAura(configured.endAuras, mh.windfuryAura);
    addOrderedProc(configured.endAuras, trinketproc1);
    addOrderedProc(configured.endAuras, trinketproc2);
    addOrderedProc(configured.endAuras, attackproc1);
    addOrderedProc(configured.endAuras, attackproc2);

    addOrderedKey(configured.endAuras, "flurry"_action);
    addOrderedKey(configured.endAuras, "deepwounds"_action);
    addOrderedKey(configured.endAuras, "deepwounds2"_action);
    addOrderedKey(configured.endAuras, "deepwounds3"_action);
    addOrderedKey(configured.endAuras, "deepwounds4"_action);

    addOrderedKey(configured.endAuras, "rend"_action);
    addOrderedKey(configured.endAuras, "berserkerrage"_action);
    addOrderedKey(configured.endAuras, "consumedrage"_action);
    addOrderedKey(configured.endAuras, "weaponbleedmh"_action);
    addOrderedKey(configured.endAuras, "weaponbleedoh"_action);

    addAuras(configured.noGcdAuras, {"swarmguard"_action, "mightyragepotion"_action});
    addSpells(configured.noGcdSpells, {"ragepotion"_action, "fireball"_action, "gunaxe"_action});
    addAuras(configured.moreNoGcdAuras, {"mildlyirradiated"_action, "jujuflurry"_action});
    addAuras(configured.onUseAuras, {"rampage"_action, "cloudkeeper"_action, "voidmadness"_action, "gyromaticacceleration"_action,
        "gneurological"_action, "coinflip"_action, "pummeler"_action, "slayer"_action,
        "spider"_action, "gabbar"_action, "earthstrike"_action, "roarguardian"_action, "zandalarian"_action, "relentlessstrength"_action,
        "demontaintedblood"_action, "wrathwray"_action, "moonstalkerfury"_action,
        "grilekguard"_action});
    addSpells(configured.queuedStrikes, {"heroicstrike"_action, "cleave"_action});

    const auto addPeriodic = [&](detail::KnownAction key, double interval) {
        const int index = auraIndex(key);
        if (index != kNoRef) configured.periodicCandidates.push_back({index, interval});
    };
    addPeriodic("bloodrage"_action, 1000);
    addPeriodic("gabbar"_action, 2000);
    addPeriodic("rend"_action, 3000);
    addAuras(configured.tickAuras, {"deepwounds"_action, "deepwounds2"_action, "deepwounds3"_action, "deepwounds4"_action});
    addAuras(configured.weaponBleeds, {"weaponbleedmh"_action, "weaponbleedoh"_action});
    addSpells(configured.timedSpells, {"bloodthirst"_action, "mortalstrike"_action,
        "shieldslam"_action, "quickstrike"_action, "ragingblow"_action, "whirlwind"_action,
        "shockwave"_action, "blademasterfury"_action, "bloodrage"_action, "ragepotion"_action,
        "overpower"_action, "execute"_action, "slam"_action});
    addAuras(configured.absoluteAuras, {"zerkforecast"_action, "battleforecast"_action,
        "defforecast"_action, "gladforecast"_action, "echoeszerk"_action,
        "echoesbattle"_action, "echoesdef"_action, "echoesglad"_action});
    addSpells(configured.stepSpells, {"ragingblow"_action, "berserkerrage"_action,
        "bloodthirst"_action, "mortalstrike"_action, "shieldslam"_action, "quickstrike"_action,
        "whirlwind"_action, "shockwave"_action, "blademasterfury"_action, "bloodrage"_action,
        "ragepotion"_action, "overpower"_action, "execute"_action,
        "hamstring"_action, "thunderclap"_action, "sunderarmor"_action,
        "slam"_action});
    addAuras(configured.periodicAuras, {"rend"_action, "deepwounds"_action,
        "weaponbleedmh"_action, "weaponbleedoh"_action,
        "deepwounds2"_action, "deepwounds3"_action, "deepwounds4"_action});
    addAuras(configured.finalAuras, {"deepwounds"_action, "deepwounds2"_action,
        "deepwounds3"_action, "deepwounds4"_action, "rend"_action, "weaponbleedmh"_action,
        "weaponbleedoh"_action});
    addSpells(configured.finalSpells, {"fireball"_action, "gunaxe"_action,
        "themoltencore"_action});

    const bool canInstallAttackProcs = std::any_of(auras.begin(), auras.end(),
        [](const AuraState& aura) { return aura.kind == AuraKind::Spicy; });
    const auto buildProcPlan = [&](WeaponState& weapon) {
        weapon.procPlan.clear();
        const auto add = [&](ProcStage stage, int action = kNoRef,
                             int secondaryAction = kNoRef, double chance = 0) {
            weapon.procPlan.push_back({stage, action, secondaryAction, chance});
        };
        const auto addAction = [&](ProcStage stage, int action,
                                   int secondaryAction = kNoRef, double chance = 0) {
            if (action != kNoRef) add(stage, action, secondaryAction, chance);
        };
        if (weapon.proc1)
            add(weapon.proc1->extraValue != 0 ? ProcStage::WeaponProc1Extra :
                                               ProcStage::WeaponProc1Damage);
        if (weapon.proc2) add(ProcStage::WeaponProc2);
        if (trinketproc1)
            add(trinketproc1->extraValue != 0 ? ProcStage::TrinketProc1Extra :
                                               ProcStage::TrinketProc1Damage);
        if (trinketproc2)
            add(trinketproc2->extraValue != 0 ? ProcStage::TrinketProc2Extra :
                                               ProcStage::TrinketProc2Damage);
        if (attackproc1 || canInstallAttackProcs)
            add(ProcStage::AttackProc1Damage);
        if (attackproc2 || canInstallAttackProcs)
            add(ProcStage::AttackProc2Damage);

        const double swordProc = talents.number("swordproc"_prop);
        if (swordProc != 0 && weapon.type == 1)
            add(ProcStage::SwordSpec, kNoRef, kNoRef, swordProc * 100);
        if (flag("wailingextra"_prop)) add(ProcStage::WailingExtra);
        if (flag("hakkariextra"_prop)) add(ProcStage::HakkariExtra);
        const double timeworn = props.number("timeworn"_prop);
        if (timeworn != 0)
            add(ProcStage::TimewornExtra, kNoRef, kNoRef, timeworn * 100);
        if (weapon.id == 233490 && weapon.proc1) {
            add(ProcStage::ObsidianStrength, auraIndex("obsidianstrength"_action));
            add(ProcStage::ObsidianHaste, auraIndex("obsidianhaste"_action));
        }
        if (flag("bloodsurge"_prop)) add(ProcStage::Bloodsurge);
        if (flag("swordboard"_prop))
            addAction(ProcStage::SwordAndBoard, spellIndex("shieldslam"_action));
        addAction(ProcStage::VoodooFrenzy, auraIndex("voodoofrenzy"_action));
        addAction(ProcStage::SuddenDeath, auraIndex("suddendeath"_action));
        if (flag("freshmeat"_prop))
            addAction(ProcStage::FreshMeat, auraIndex("freshmeat"_action));
        addAction(ProcStage::SingleMinded, auraIndex("singleminded"_action));
        addAction(ProcStage::Windfury, weapon.windfuryAura);
        const int swarmguard = auraIndex("swarmguard"_action);
        addAction(ProcStage::Swarmguard, swarmguard, kNoRef,
                  swarmguard == kNoRef ? 0 :
                      auras[static_cast<std::size_t>(swarmguard)].props.number("chance"_prop));
        addAction(ProcStage::Zandalarian, auraIndex("zandalarian"_action));
        addAction(ProcStage::RelentlessStrength, auraIndex("relentlessstrength"_action));
        if (flag("dragonbreath"_prop)) add(ProcStage::Dragonbreath);
    };
    buildProcPlan(mh);
    if (oh) buildProcPlan(*oh);
    configured.procTailFlurry = auraIndex("flurry"_action);
    configured.procTailUnrelentingStrikes = kNoRef;
}

Engine::Engine(PlayerState player, SimConfig sim, std::uint32_t seed)
    : player_(std::move(player)), sim_(sim), baseSeed_(seed) {
    player_.props.set("batching"_prop, sim_.batching);
}

BatchReport Engine::runBatch(std::uint32_t count, std::uint32_t globalIterationOffset,
                             bool /*fullReport*/) {
    // These fields are observational counters only. Resetting them at the batch
    // boundary makes every returned player report a mergeable delta without
    // changing persistent combat configuration or per-fight reset semantics.
    player_.mh.totaldmg = player_.mh.totalprocdmg = 0;
    player_.mh.data.fill(0);
    if (player_.oh) {
        player_.oh->totaldmg = player_.oh->totalprocdmg = 0;
        player_.oh->data.fill(0);
    }
    for (auto& spell : player_.spells) {
        spell.totaldmg = 0;
        spell.totalusedrage = 0;
        spell.data.fill(0);
    }
    for (auto& aura : player_.auras) {
        aura.uptime = aura.totaldmg = 0;
        std::fill(aura.data.begin(), aura.data.end(), 0);
    }
    BatchReport report;
    report.iterations = count;
    const auto started = std::chrono::system_clock::now();
    report.starttime = std::chrono::duration<double, std::milli>(started.time_since_epoch()).count();
    for (std::uint32_t i = 0; i < count; ++i) {
        double duration = 0;
        const double damage = runOne(globalIterationOffset + i, duration);
        const double dps = duration > 0 ? damage / duration : 0;
        report.totaldmg += damage;
        report.totalduration += duration;
        report.mindps = std::min(report.mindps, dps);
        report.maxdps = std::max(report.maxdps, dps);
        report.sumdps += dps;
        report.sumdps2 += dps * dps;
        ++report.spread[static_cast<std::int32_t>(std::floor(dps + 0.5))];
    }
    if (!count) report.mindps = 99999;
    const auto ended = std::chrono::system_clock::now();
    report.endtime = std::chrono::duration<double, std::milli>(ended.time_since_epoch()).count();
    return report;
}

std::string Engine::reportJson(const BatchReport& report, bool fullReport) const {
    std::ostringstream out;
    out << "{\"iterations\":" << report.iterations << ",\"totaldmg\":";
    jsonNumber(out, report.totaldmg);
    out << ",\"totalduration\":"; jsonNumber(out, report.totalduration);
    out << ",\"mindps\":"; jsonNumber(out, report.mindps);
    out << ",\"maxdps\":"; jsonNumber(out, report.maxdps);
    out << ",\"sumdps\":"; jsonNumber(out, report.sumdps);
    out << ",\"sumdps2\":"; jsonNumber(out, report.sumdps2);
    out << ",\"starttime\":"; jsonNumber(out, report.starttime);
    out << ",\"endtime\":"; jsonNumber(out, report.endtime);
    out << ",\"engineVersion\":" << kEngineVersion << ",\"seed\":" << baseSeed_;
    if (fullReport) {
        out << ",\"spread\":{";
        bool first = true;
        for (const auto& [dps, count] : report.spread) {
            if (!first) out << ',';
            first = false;
            out << '\"' << dps << "\":" << count;
        }
        out << "},\"player\":{\"auras\":{";
        first = true;
        for (const auto& aura : player_.auras) {
            if (!first) out << ',';
            first = false;
            out << '\"' << jsonEscape(aura.key) << "\":{\"name\":\""
                << jsonEscape(aura.props.string("name"_prop, aura.key)) << "\",\"uptime\":";
            jsonNumber(out, aura.uptime);
            out << ",\"totaldmg\":"; jsonNumber(out, aura.totaldmg);
            out << ",\"data\":[";
            for (std::size_t i = 0; i < aura.data.size(); ++i) {
                if (i) out << ',';
                jsonNumber(out, aura.data[i]);
            }
            out << "]}";
        }
        out << "},\"spells\":{";
        first = true;
        for (const auto& spell : player_.spells) {
            if (!first) out << ',';
            first = false;
            out << '\"' << jsonEscape(spell.key) << "\":{\"name\":\""
                << jsonEscape(spell.props.string("name"_prop, spell.key)) << "\",\"cost\":";
            jsonNumber(out, spell.props.number("cost"_prop));
            out << ",\"totalusedrage\":"; jsonNumber(out, spell.totalusedrage);
            out << ",\"totaldmg\":";
            jsonNumber(out, spell.totaldmg);
            out << ",\"data\":[";
            for (std::size_t i = 0; i < spell.data.size(); ++i) {
                if (i) out << ',';
                out << spell.data[i];
            }
            out << "]}";
        }
        out << "},\"mh\":{\"name\":\"" << jsonEscape(player_.mh.name)
            << "\",\"totaldmg\":"; jsonNumber(out, player_.mh.totaldmg);
        out << ",\"totalprocdmg\":"; jsonNumber(out, player_.mh.totalprocdmg);
        out << ",\"data\":[";
        for (std::size_t i = 0; i < player_.mh.data.size(); ++i) { if (i) out << ','; out << player_.mh.data[i]; }
        out << "]}";
        if (player_.oh) {
            out << ",\"oh\":{\"name\":\"" << jsonEscape(player_.oh->name)
                << "\",\"totaldmg\":"; jsonNumber(out, player_.oh->totaldmg);
            out << ",\"totalprocdmg\":"; jsonNumber(out, player_.oh->totalprocdmg);
            out << ",\"data\":[";
            for (std::size_t i = 0; i < player_.oh->data.size(); ++i) { if (i) out << ','; out << player_.oh->data[i]; }
            out << "]}";
        }
        out << "}";
    }
    out << '}';
    return out.str();
}

} // namespace warriorsim

EMSCRIPTEN_BINDINGS(warriorsim_engine) {
    emscripten::function("createEngine", &warriorsim::createEngineBinding);
    emscripten::function("runBatch", &warriorsim::runBatchBinding);
    emscripten::function("destroyEngine", &warriorsim::destroyEngineBinding);
}
