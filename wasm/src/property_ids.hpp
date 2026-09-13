#pragma once

#include <array>
#include <cstdint>
#include <string_view>

namespace warriorsim::detail {

inline constexpr std::size_t kDensePropertyCount = 215;
inline constexpr std::array<std::string_view, kDensePropertyCount> kDensePropertyNames = {
    "abilitiescrit",
    "adjacent",
    "agi",
    "agimod",
    "agipercrit",
    "altdreadnaughtfourset",
    "altdreadnaughttwoset",
    "altmightthreeset",
    "alwaysheads",
    "alwaystails",
    "angermanagement",
    "ap",
    "apmod",
    "aprace",
    "armor",
    "armorReduction",
    "arp",
    "arpContribution",
    "baseapmod",
    "basearmor",
    "basearmorbuffed",
    "basebonusdmg",
    "basemaxdmg",
    "basemindmg",
    "basestance",
    "batching",
    "binaryresist",
    "binaryspell",
    "bleedbonus",
    "bleedmod",
    "block",
    "bloodfrenzy",
    "bloodsurge",
    "bonus",
    "bonusdmg",
    "canDodge",
    "castspeed",
    "casttime",
    "chance",
    "chargeblock",
    "coeff",
    "cooldown",
    "cost",
    "crit",
    "critdmgbonus",
    "dataLength",
    "deepwounds",
    "defense",
    "defenseType",
    "devastate",
    "dmg",
    "dmgmod",
    "dodge",
    "dragonbreath",
    "dumpmod",
    "duration",
    "enrage",
    "exmacro",
    "expertise",
    "exposed",
    "extra",
    "extracritrage",
    "extrarage",
    "faeriefire",
    "freshmeat",
    "furiousthunder",
    "gcd",
    "globals",
    "hakkariextra",
    "hasFlurry",
    "haste",
    "heroicbonus",
    "hit",
    "homunculi",
    "id",
    "impslam",
    "interval",
    "item",
    "level",
    "macearp",
    "magicdmg",
    "maincd",
    "mainspelldmg",
    "maxdelay",
    "maxdmg",
    "maxrage",
    "mhthreshold",
    "mindmg",
    "minrage",
    "misschance",
    "mitigation",
    "moddmgdone",
    "moddmgtaken",
    "mode",
    "modifier",
    "name",
    "nocrit",
    "noitemcd",
    "normSpeed",
    "offensive",
    "offhand",
    "offhit",
    "overpowercrit",
    "overpowerrend",
    "phantom",
    "physdmg",
    "procblock",
    "rage",
    "rageblock",
    "ragecap",
    "rageconversion",
    "ragemod",
    "rageretained",
    "reactionmax",
    "reactionmin",
    "refund",
    "resolve",
    "school",
    "secondarystance",
    "shield",
    "skill_",
    "skill_0",
    "skill_1",
    "skill_10",
    "skill_11",
    "skill_12",
    "skill_13",
    "skill_14",
    "skill_15",
    "skill_16",
    "skill_17",
    "skill_18",
    "skill_19",
    "skill_2",
    "skill_20",
    "skill_21",
    "skill_22",
    "skill_23",
    "skill_24",
    "skill_25",
    "skill_26",
    "skill_27",
    "skill_28",
    "skill_29",
    "skill_3",
    "skill_30",
    "skill_31",
    "skill_32",
    "skill_33",
    "skill_34",
    "skill_35",
    "skill_36",
    "skill_37",
    "skill_38",
    "skill_39",
    "skill_4",
    "skill_40",
    "skill_5",
    "skill_6",
    "skill_7",
    "skill_8",
    "skill_9",
    "slammainreset",
    "speed",
    "spellcrit",
    "spelldamage",
    "spelldmgmod",
    "spellqueueing",
    "spicy",
    "stance",
    "str",
    "strmod",
    "swingpercent",
    "swingtimer",
    "swingtimerless",
    "switchdefault",
    "switchdelay",
    "switchechoesactive",
    "switchechoesrage",
    "switchechoestime",
    "switchoractive",
    "switchorrage",
    "switchortime",
    "switchrage",
    "switchstart",
    "switchtime",
    "switchtimeactive",
    "switchto",
    "swordboard",
    "swordproc",
    "tasteforblood",
    "tfbstep",
    "tickdmg",
    "timer",
    "timetoend",
    "timetostart",
    "timeworn",
    "twohand",
    "type",
    "umbridledwrath",
    "unqueue",
    "unqueuetimer",
    "useonly",
    "usestep",
    "vaelbuff",
    "value",
    "value1",
    "value2",
    "wailingextra",
    "weaponspell",
    "wwcd",
    "zerkerpriority",
    "afterswing",
    "swingreset",
    "dodgetimeworn",
};

constexpr std::uint64_t propertyHash(std::string_view value) {
    std::uint64_t result = 0xcbf29ce484222325ull;
    for (const unsigned char c : value) { result ^= c; result *= 0x100000001b3ull; }
    return result;
}

constexpr int propertyIndex(std::string_view value) {
    switch (propertyHash(value)) {
    case propertyHash("abilitiescrit"): return value == "abilitiescrit" ? 0 : -1;
    case propertyHash("adjacent"): return value == "adjacent" ? 1 : -1;
    case propertyHash("agi"): return value == "agi" ? 2 : -1;
    case propertyHash("agimod"): return value == "agimod" ? 3 : -1;
    case propertyHash("agipercrit"): return value == "agipercrit" ? 4 : -1;
    case propertyHash("altdreadnaughtfourset"): return value == "altdreadnaughtfourset" ? 5 : -1;
    case propertyHash("altdreadnaughttwoset"): return value == "altdreadnaughttwoset" ? 6 : -1;
    case propertyHash("altmightthreeset"): return value == "altmightthreeset" ? 7 : -1;
    case propertyHash("alwaysheads"): return value == "alwaysheads" ? 8 : -1;
    case propertyHash("alwaystails"): return value == "alwaystails" ? 9 : -1;
    case propertyHash("angermanagement"): return value == "angermanagement" ? 10 : -1;
    case propertyHash("ap"): return value == "ap" ? 11 : -1;
    case propertyHash("apmod"): return value == "apmod" ? 12 : -1;
    case propertyHash("aprace"): return value == "aprace" ? 13 : -1;
    case propertyHash("armor"): return value == "armor" ? 14 : -1;
    case propertyHash("armorReduction"): return value == "armorReduction" ? 15 : -1;
    case propertyHash("arp"): return value == "arp" ? 16 : -1;
    case propertyHash("arpContribution"): return value == "arpContribution" ? 17 : -1;
    case propertyHash("baseapmod"): return value == "baseapmod" ? 18 : -1;
    case propertyHash("basearmor"): return value == "basearmor" ? 19 : -1;
    case propertyHash("basearmorbuffed"): return value == "basearmorbuffed" ? 20 : -1;
    case propertyHash("basebonusdmg"): return value == "basebonusdmg" ? 21 : -1;
    case propertyHash("basemaxdmg"): return value == "basemaxdmg" ? 22 : -1;
    case propertyHash("basemindmg"): return value == "basemindmg" ? 23 : -1;
    case propertyHash("basestance"): return value == "basestance" ? 24 : -1;
    case propertyHash("batching"): return value == "batching" ? 25 : -1;
    case propertyHash("binaryresist"): return value == "binaryresist" ? 26 : -1;
    case propertyHash("binaryspell"): return value == "binaryspell" ? 27 : -1;
    case propertyHash("bleedbonus"): return value == "bleedbonus" ? 28 : -1;
    case propertyHash("bleedmod"): return value == "bleedmod" ? 29 : -1;
    case propertyHash("block"): return value == "block" ? 30 : -1;
    case propertyHash("bloodfrenzy"): return value == "bloodfrenzy" ? 31 : -1;
    case propertyHash("bloodsurge"): return value == "bloodsurge" ? 32 : -1;
    case propertyHash("bonus"): return value == "bonus" ? 33 : -1;
    case propertyHash("bonusdmg"): return value == "bonusdmg" ? 34 : -1;
    case propertyHash("canDodge"): return value == "canDodge" ? 35 : -1;
    case propertyHash("castspeed"): return value == "castspeed" ? 36 : -1;
    case propertyHash("casttime"): return value == "casttime" ? 37 : -1;
    case propertyHash("chance"): return value == "chance" ? 38 : -1;
    case propertyHash("chargeblock"): return value == "chargeblock" ? 39 : -1;
    case propertyHash("coeff"): return value == "coeff" ? 40 : -1;
    case propertyHash("cooldown"): return value == "cooldown" ? 41 : -1;
    case propertyHash("cost"): return value == "cost" ? 42 : -1;
    case propertyHash("crit"): return value == "crit" ? 43 : -1;
    case propertyHash("critdmgbonus"): return value == "critdmgbonus" ? 44 : -1;
    case propertyHash("dataLength"): return value == "dataLength" ? 45 : -1;
    case propertyHash("deepwounds"): return value == "deepwounds" ? 46 : -1;
    case propertyHash("defense"): return value == "defense" ? 47 : -1;
    case propertyHash("defenseType"): return value == "defenseType" ? 48 : -1;
    case propertyHash("devastate"): return value == "devastate" ? 49 : -1;
    case propertyHash("dmg"): return value == "dmg" ? 50 : -1;
    case propertyHash("dmgmod"): return value == "dmgmod" ? 51 : -1;
    case propertyHash("dodge"): return value == "dodge" ? 52 : -1;
    case propertyHash("dragonbreath"): return value == "dragonbreath" ? 53 : -1;
    case propertyHash("dumpmod"): return value == "dumpmod" ? 54 : -1;
    case propertyHash("duration"): return value == "duration" ? 55 : -1;
    case propertyHash("enrage"): return value == "enrage" ? 56 : -1;
    case propertyHash("exmacro"): return value == "exmacro" ? 57 : -1;
    case propertyHash("expertise"): return value == "expertise" ? 58 : -1;
    case propertyHash("exposed"): return value == "exposed" ? 59 : -1;
    case propertyHash("extra"): return value == "extra" ? 60 : -1;
    case propertyHash("extracritrage"): return value == "extracritrage" ? 61 : -1;
    case propertyHash("extrarage"): return value == "extrarage" ? 62 : -1;
    case propertyHash("faeriefire"): return value == "faeriefire" ? 63 : -1;
    case propertyHash("freshmeat"): return value == "freshmeat" ? 64 : -1;
    case propertyHash("furiousthunder"): return value == "furiousthunder" ? 65 : -1;
    case propertyHash("gcd"): return value == "gcd" ? 66 : -1;
    case propertyHash("globals"): return value == "globals" ? 67 : -1;
    case propertyHash("hakkariextra"): return value == "hakkariextra" ? 68 : -1;
    case propertyHash("hasFlurry"): return value == "hasFlurry" ? 69 : -1;
    case propertyHash("haste"): return value == "haste" ? 70 : -1;
    case propertyHash("heroicbonus"): return value == "heroicbonus" ? 71 : -1;
    case propertyHash("hit"): return value == "hit" ? 72 : -1;
    case propertyHash("homunculi"): return value == "homunculi" ? 73 : -1;
    case propertyHash("id"): return value == "id" ? 74 : -1;
    case propertyHash("impslam"): return value == "impslam" ? 75 : -1;
    case propertyHash("interval"): return value == "interval" ? 76 : -1;
    case propertyHash("item"): return value == "item" ? 77 : -1;
    case propertyHash("level"): return value == "level" ? 78 : -1;
    case propertyHash("macearp"): return value == "macearp" ? 79 : -1;
    case propertyHash("magicdmg"): return value == "magicdmg" ? 80 : -1;
    case propertyHash("maincd"): return value == "maincd" ? 81 : -1;
    case propertyHash("mainspelldmg"): return value == "mainspelldmg" ? 82 : -1;
    case propertyHash("maxdelay"): return value == "maxdelay" ? 83 : -1;
    case propertyHash("maxdmg"): return value == "maxdmg" ? 84 : -1;
    case propertyHash("maxrage"): return value == "maxrage" ? 85 : -1;
    case propertyHash("mhthreshold"): return value == "mhthreshold" ? 86 : -1;
    case propertyHash("mindmg"): return value == "mindmg" ? 87 : -1;
    case propertyHash("minrage"): return value == "minrage" ? 88 : -1;
    case propertyHash("misschance"): return value == "misschance" ? 89 : -1;
    case propertyHash("mitigation"): return value == "mitigation" ? 90 : -1;
    case propertyHash("moddmgdone"): return value == "moddmgdone" ? 91 : -1;
    case propertyHash("moddmgtaken"): return value == "moddmgtaken" ? 92 : -1;
    case propertyHash("mode"): return value == "mode" ? 93 : -1;
    case propertyHash("modifier"): return value == "modifier" ? 94 : -1;
    case propertyHash("name"): return value == "name" ? 95 : -1;
    case propertyHash("nocrit"): return value == "nocrit" ? 96 : -1;
    case propertyHash("noitemcd"): return value == "noitemcd" ? 97 : -1;
    case propertyHash("normSpeed"): return value == "normSpeed" ? 98 : -1;
    case propertyHash("offensive"): return value == "offensive" ? 99 : -1;
    case propertyHash("offhand"): return value == "offhand" ? 100 : -1;
    case propertyHash("offhit"): return value == "offhit" ? 101 : -1;
    case propertyHash("overpowercrit"): return value == "overpowercrit" ? 102 : -1;
    case propertyHash("overpowerrend"): return value == "overpowerrend" ? 103 : -1;
    case propertyHash("phantom"): return value == "phantom" ? 104 : -1;
    case propertyHash("physdmg"): return value == "physdmg" ? 105 : -1;
    case propertyHash("procblock"): return value == "procblock" ? 106 : -1;
    case propertyHash("rage"): return value == "rage" ? 107 : -1;
    case propertyHash("rageblock"): return value == "rageblock" ? 108 : -1;
    case propertyHash("ragecap"): return value == "ragecap" ? 109 : -1;
    case propertyHash("rageconversion"): return value == "rageconversion" ? 110 : -1;
    case propertyHash("ragemod"): return value == "ragemod" ? 111 : -1;
    case propertyHash("rageretained"): return value == "rageretained" ? 112 : -1;
    case propertyHash("reactionmax"): return value == "reactionmax" ? 113 : -1;
    case propertyHash("reactionmin"): return value == "reactionmin" ? 114 : -1;
    case propertyHash("refund"): return value == "refund" ? 115 : -1;
    case propertyHash("resolve"): return value == "resolve" ? 116 : -1;
    case propertyHash("school"): return value == "school" ? 117 : -1;
    case propertyHash("secondarystance"): return value == "secondarystance" ? 118 : -1;
    case propertyHash("shield"): return value == "shield" ? 119 : -1;
    case propertyHash("skill_"): return value == "skill_" ? 120 : -1;
    case propertyHash("skill_0"): return value == "skill_0" ? 121 : -1;
    case propertyHash("skill_1"): return value == "skill_1" ? 122 : -1;
    case propertyHash("skill_10"): return value == "skill_10" ? 123 : -1;
    case propertyHash("skill_11"): return value == "skill_11" ? 124 : -1;
    case propertyHash("skill_12"): return value == "skill_12" ? 125 : -1;
    case propertyHash("skill_13"): return value == "skill_13" ? 126 : -1;
    case propertyHash("skill_14"): return value == "skill_14" ? 127 : -1;
    case propertyHash("skill_15"): return value == "skill_15" ? 128 : -1;
    case propertyHash("skill_16"): return value == "skill_16" ? 129 : -1;
    case propertyHash("skill_17"): return value == "skill_17" ? 130 : -1;
    case propertyHash("skill_18"): return value == "skill_18" ? 131 : -1;
    case propertyHash("skill_19"): return value == "skill_19" ? 132 : -1;
    case propertyHash("skill_2"): return value == "skill_2" ? 133 : -1;
    case propertyHash("skill_20"): return value == "skill_20" ? 134 : -1;
    case propertyHash("skill_21"): return value == "skill_21" ? 135 : -1;
    case propertyHash("skill_22"): return value == "skill_22" ? 136 : -1;
    case propertyHash("skill_23"): return value == "skill_23" ? 137 : -1;
    case propertyHash("skill_24"): return value == "skill_24" ? 138 : -1;
    case propertyHash("skill_25"): return value == "skill_25" ? 139 : -1;
    case propertyHash("skill_26"): return value == "skill_26" ? 140 : -1;
    case propertyHash("skill_27"): return value == "skill_27" ? 141 : -1;
    case propertyHash("skill_28"): return value == "skill_28" ? 142 : -1;
    case propertyHash("skill_29"): return value == "skill_29" ? 143 : -1;
    case propertyHash("skill_3"): return value == "skill_3" ? 144 : -1;
    case propertyHash("skill_30"): return value == "skill_30" ? 145 : -1;
    case propertyHash("skill_31"): return value == "skill_31" ? 146 : -1;
    case propertyHash("skill_32"): return value == "skill_32" ? 147 : -1;
    case propertyHash("skill_33"): return value == "skill_33" ? 148 : -1;
    case propertyHash("skill_34"): return value == "skill_34" ? 149 : -1;
    case propertyHash("skill_35"): return value == "skill_35" ? 150 : -1;
    case propertyHash("skill_36"): return value == "skill_36" ? 151 : -1;
    case propertyHash("skill_37"): return value == "skill_37" ? 152 : -1;
    case propertyHash("skill_38"): return value == "skill_38" ? 153 : -1;
    case propertyHash("skill_39"): return value == "skill_39" ? 154 : -1;
    case propertyHash("skill_4"): return value == "skill_4" ? 155 : -1;
    case propertyHash("skill_40"): return value == "skill_40" ? 156 : -1;
    case propertyHash("skill_5"): return value == "skill_5" ? 157 : -1;
    case propertyHash("skill_6"): return value == "skill_6" ? 158 : -1;
    case propertyHash("skill_7"): return value == "skill_7" ? 159 : -1;
    case propertyHash("skill_8"): return value == "skill_8" ? 160 : -1;
    case propertyHash("skill_9"): return value == "skill_9" ? 161 : -1;
    case propertyHash("slammainreset"): return value == "slammainreset" ? 162 : -1;
    case propertyHash("speed"): return value == "speed" ? 163 : -1;
    case propertyHash("spellcrit"): return value == "spellcrit" ? 164 : -1;
    case propertyHash("spelldamage"): return value == "spelldamage" ? 165 : -1;
    case propertyHash("spelldmgmod"): return value == "spelldmgmod" ? 166 : -1;
    case propertyHash("spellqueueing"): return value == "spellqueueing" ? 167 : -1;
    case propertyHash("spicy"): return value == "spicy" ? 168 : -1;
    case propertyHash("stance"): return value == "stance" ? 169 : -1;
    case propertyHash("str"): return value == "str" ? 170 : -1;
    case propertyHash("strmod"): return value == "strmod" ? 171 : -1;
    case propertyHash("swingpercent"): return value == "swingpercent" ? 172 : -1;
    case propertyHash("swingtimer"): return value == "swingtimer" ? 173 : -1;
    case propertyHash("swingtimerless"): return value == "swingtimerless" ? 174 : -1;
    case propertyHash("switchdefault"): return value == "switchdefault" ? 175 : -1;
    case propertyHash("switchdelay"): return value == "switchdelay" ? 176 : -1;
    case propertyHash("switchechoesactive"): return value == "switchechoesactive" ? 177 : -1;
    case propertyHash("switchechoesrage"): return value == "switchechoesrage" ? 178 : -1;
    case propertyHash("switchechoestime"): return value == "switchechoestime" ? 179 : -1;
    case propertyHash("switchoractive"): return value == "switchoractive" ? 180 : -1;
    case propertyHash("switchorrage"): return value == "switchorrage" ? 181 : -1;
    case propertyHash("switchortime"): return value == "switchortime" ? 182 : -1;
    case propertyHash("switchrage"): return value == "switchrage" ? 183 : -1;
    case propertyHash("switchstart"): return value == "switchstart" ? 184 : -1;
    case propertyHash("switchtime"): return value == "switchtime" ? 185 : -1;
    case propertyHash("switchtimeactive"): return value == "switchtimeactive" ? 186 : -1;
    case propertyHash("switchto"): return value == "switchto" ? 187 : -1;
    case propertyHash("swordboard"): return value == "swordboard" ? 188 : -1;
    case propertyHash("swordproc"): return value == "swordproc" ? 189 : -1;
    case propertyHash("tasteforblood"): return value == "tasteforblood" ? 190 : -1;
    case propertyHash("tfbstep"): return value == "tfbstep" ? 191 : -1;
    case propertyHash("tickdmg"): return value == "tickdmg" ? 192 : -1;
    case propertyHash("timer"): return value == "timer" ? 193 : -1;
    case propertyHash("timetoend"): return value == "timetoend" ? 194 : -1;
    case propertyHash("timetostart"): return value == "timetostart" ? 195 : -1;
    case propertyHash("timeworn"): return value == "timeworn" ? 196 : -1;
    case propertyHash("twohand"): return value == "twohand" ? 197 : -1;
    case propertyHash("type"): return value == "type" ? 198 : -1;
    case propertyHash("umbridledwrath"): return value == "umbridledwrath" ? 199 : -1;
    case propertyHash("unqueue"): return value == "unqueue" ? 200 : -1;
    case propertyHash("unqueuetimer"): return value == "unqueuetimer" ? 201 : -1;
    case propertyHash("useonly"): return value == "useonly" ? 202 : -1;
    case propertyHash("usestep"): return value == "usestep" ? 203 : -1;
    case propertyHash("vaelbuff"): return value == "vaelbuff" ? 204 : -1;
    case propertyHash("value"): return value == "value" ? 205 : -1;
    case propertyHash("value1"): return value == "value1" ? 206 : -1;
    case propertyHash("value2"): return value == "value2" ? 207 : -1;
    case propertyHash("wailingextra"): return value == "wailingextra" ? 208 : -1;
    case propertyHash("weaponspell"): return value == "weaponspell" ? 209 : -1;
    case propertyHash("wwcd"): return value == "wwcd" ? 210 : -1;
    case propertyHash("zerkerpriority"): return value == "zerkerpriority" ? 211 : -1;
    case propertyHash("afterswing"): return value == "afterswing" ? 212 : -1;
    case propertyHash("swingreset"): return value == "swingreset" ? 213 : -1;
    case propertyHash("dodgetimeworn"): return value == "dodgetimeworn" ? 214 : -1;
    default: return -1;
    }
}

struct KnownProperty {
    int index;
    template<std::size_t N>
    explicit consteval KnownProperty(const char (&value)[N])
        : index(propertyIndex(std::string_view(value, N - 1))) {
        if (index < 0) throw "unknown native simulation property";
    }
    constexpr explicit KnownProperty(int value) : index(value) {}
};

} // namespace warriorsim::detail

namespace warriorsim {

// A literal property name is resolved by the compiler.  Keeping the slot in a
// distinct type makes it impossible for a hot-path accessor to fall back to a
// runtime string hash/compare by accident.
consteval detail::KnownProperty operator""_prop(const char* value, std::size_t size) {
    const int index = detail::propertyIndex(std::string_view(value, size));
    if (index < 0) throw "unknown native simulation property";
    return detail::KnownProperty{index};
}

} // namespace warriorsim
