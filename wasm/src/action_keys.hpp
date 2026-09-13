#pragma once

#include <array>
#include <cstdint>
#include <string_view>

namespace warriorsim::detail {

inline constexpr std::size_t kActionKeyCount = 325;
inline constexpr std::array<std::string_view, kActionKeyCount> kActionKeyNames = {
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
    "annihilator",
    "ap",
    "apmod",
    "aprace",
    "armor",
    "arp",
    "attackproc1",
    "attackproc2",
    "aura",
    "auras",
    "base",
    "baseapmod",
    "basearmor",
    "basearmorbuffed",
    "basebonusdmg",
    "basemaxdmg",
    "basemindmg",
    "basestance",
    "batching",
    "battle",
    "battleforecast",
    "battleshout",
    "battlestance",
    "berserkerrage",
    "berserkerstance",
    "berserking",
    "binaryresist",
    "binaryspell",
    "blademasterfury",
    "bleedbonus",
    "bleedmod",
    "blisteringragehammer",
    "block",
    "bloodfrenzy",
    "bloodfury",
    "bloodlust",
    "bloodrage",
    "bloodsurge",
    "bloodthirst",
    "bonereaver",
    "bonus",
    "bonusdmg",
    "boolean",
    "castspeed",
    "casttime",
    "chance",
    "chargeblock",
    "chastise",
    "cleave",
    "cleavearmor",
    "cloudkeeper",
    "coeff",
    "coinflip",
    "consumedrage",
    "cooldown",
    "cost",
    "count",
    "crit",
    "critdmgbonus",
    "crusaderzeal",
    "deathwish",
    "deepwounds",
    "deepwounds2",
    "deepwounds3",
    "deepwounds4",
    "def",
    "defendersresolve",
    "defense",
    "defensivestance",
    "defforecast",
    "demontaintedblood",
    "devastate",
    "dmg",
    "dmgmod",
    "dodge",
    "dragonbreath",
    "dumpmod",
    "duration",
    "earthstrike",
    "echoes",
    "echoesbattle",
    "echoesdef",
    "echoesdread",
    "echoesglad",
    "echoeszerk",
    "empyrean",
    "enrage",
    "eskhandar",
    "execute",
    "executeperc",
    "exmacro",
    "expertise",
    "exposed",
    "extra",
    "extracritrage",
    "extrarage",
    "faeriefire",
    "fireball",
    "flask",
    "flurry",
    "forecast",
    "freshmeat",
    "furiousthunder",
    "gabbar",
    "gcd",
    "glad",
    "gladforecast",
    "gladiatorstance",
    "globals",
    "gneurological",
    "grilekfury",
    "grilekguard",
    "gunaxe",
    "gyromaticacceleration",
    "hakkariextra",
    "hamstring",
    "handle",
    "haste",
    "hategrips",
    "heroicbonus",
    "heroicstrike",
    "hit",
    "homunculi",
    "id",
    "impslam",
    "interval",
    "item",
    "jackhammer",
    "jujuflurry",
    "key",
    "keys",
    "kind",
    "length",
    "level",
    "links",
    "macearp",
    "magicdmg",
    "magmadarsreturn",
    "maincd",
    "mainspelldmg",
    "masterstrike",
    "maxdelay",
    "maxdmg",
    "maxrage",
    "meltarmor",
    "mh",
    "mhthreshold",
    "mightyragepotion",
    "mildlyirradiated",
    "mindmg",
    "minrage",
    "misschance",
    "mitigation",
    "moddmgdone",
    "moddmgtaken",
    "mode",
    "modifier",
    "modrag",
    "moltenemberstone",
    "moonstalkerfury",
    "mortalstrike",
    "name",
    "nocrit",
    "noitemcd",
    "null",
    "number",
    "object",
    "obsidianhaste",
    "obsidianstrength",
    "offensive",
    "offhand",
    "offhit",
    "oh",
    "overpower",
    "overpowercrit",
    "overpowerrend",
    "parse",
    "phantom",
    "physdmg",
    "player",
    "potentvenoms",
    "potentvenoms2",
    "proc1",
    "proc2",
    "procblock",
    "procs",
    "props",
    "pummel",
    "pummeler",
    "quicknesspotion",
    "quickstrike",
    "rage",
    "rageblock",
    "ragecap",
    "rageconversion",
    "ragehammer",
    "ragemod",
    "ragepotion",
    "rageretained",
    "ragingblow",
    "rampage",
    "reactionmax",
    "reactionmin",
    "recklessness",
    "refund",
    "relentlessstrength",
    "rend",
    "resolve",
    "rivenspike",
    "roarguardian",
    "school",
    "secondarystance",
    "seed",
    "shield",
    "shieldrender",
    "shieldslam",
    "shockwave",
    "sim",
    "singleminded",
    "skill_",
    "slam",
    "slammainreset",
    "slayer",
    "sod",
    "speed",
    "spell",
    "spellcrit",
    "spelldamage",
    "spelldmgmod",
    "spellqueueing",
    "spells",
    "spicy",
    "spider",
    "stance",
    "stanceswitch",
    "startrage",
    "stats",
    "stoneslayer",
    "str",
    "string",
    "strmod",
    "suddendeath",
    "sunderarmor",
    "swarmguard",
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
    "talents",
    "target",
    "tasteforblood",
    "tempest",
    "tfbstep",
    "themoltencore",
    "thunderclap",
    "tickdmg",
    "timer",
    "timesecsmax",
    "timesecsmin",
    "timetoend",
    "timetostart",
    "timeworn",
    "trinketproc1",
    "trinketproc2",
    "turtle",
    "twohand",
    "type",
    "ultrasonic",
    "umbridledwrath",
    "unqueue",
    "unqueuetimer",
    "unrelentingstrikes",
    "unstoppablemight",
    "useonly",
    "usestep",
    "vaelbuff",
    "value",
    "value1",
    "value2",
    "version",
    "vibroblade",
    "victoryrush",
    "voidmadness",
    "voodoofrenzy",
    "wailingextra",
    "weapon",
    "weaponbleedmh",
    "weaponbleedoh",
    "weapons",
    "weaponspell",
    "whirlwind",
    "worgenmark",
    "wrathwray",
    "wreckingcrew",
    "wwcd",
    "zandalarian",
    "zeal",
    "zerk",
    "zerkerpriority",
    "zerkforecast",
};

constexpr std::uint64_t actionKeyHash(std::string_view value) {
    std::uint64_t result = 0xcbf29ce484222325ull;
    for (const unsigned char c : value) { result ^= c; result *= 0x100000001b3ull; }
    return result;
}

constexpr int actionKeyIndex(std::string_view value) {
    switch (actionKeyHash(value)) {
    case actionKeyHash("abilitiescrit"): return value == "abilitiescrit" ? 0 : -1;
    case actionKeyHash("adjacent"): return value == "adjacent" ? 1 : -1;
    case actionKeyHash("agi"): return value == "agi" ? 2 : -1;
    case actionKeyHash("agimod"): return value == "agimod" ? 3 : -1;
    case actionKeyHash("agipercrit"): return value == "agipercrit" ? 4 : -1;
    case actionKeyHash("altdreadnaughtfourset"): return value == "altdreadnaughtfourset" ? 5 : -1;
    case actionKeyHash("altdreadnaughttwoset"): return value == "altdreadnaughttwoset" ? 6 : -1;
    case actionKeyHash("altmightthreeset"): return value == "altmightthreeset" ? 7 : -1;
    case actionKeyHash("alwaysheads"): return value == "alwaysheads" ? 8 : -1;
    case actionKeyHash("alwaystails"): return value == "alwaystails" ? 9 : -1;
    case actionKeyHash("angermanagement"): return value == "angermanagement" ? 10 : -1;
    case actionKeyHash("annihilator"): return value == "annihilator" ? 11 : -1;
    case actionKeyHash("ap"): return value == "ap" ? 12 : -1;
    case actionKeyHash("apmod"): return value == "apmod" ? 13 : -1;
    case actionKeyHash("aprace"): return value == "aprace" ? 14 : -1;
    case actionKeyHash("armor"): return value == "armor" ? 15 : -1;
    case actionKeyHash("arp"): return value == "arp" ? 16 : -1;
    case actionKeyHash("attackproc1"): return value == "attackproc1" ? 17 : -1;
    case actionKeyHash("attackproc2"): return value == "attackproc2" ? 18 : -1;
    case actionKeyHash("aura"): return value == "aura" ? 19 : -1;
    case actionKeyHash("auras"): return value == "auras" ? 20 : -1;
    case actionKeyHash("base"): return value == "base" ? 21 : -1;
    case actionKeyHash("baseapmod"): return value == "baseapmod" ? 22 : -1;
    case actionKeyHash("basearmor"): return value == "basearmor" ? 23 : -1;
    case actionKeyHash("basearmorbuffed"): return value == "basearmorbuffed" ? 24 : -1;
    case actionKeyHash("basebonusdmg"): return value == "basebonusdmg" ? 25 : -1;
    case actionKeyHash("basemaxdmg"): return value == "basemaxdmg" ? 26 : -1;
    case actionKeyHash("basemindmg"): return value == "basemindmg" ? 27 : -1;
    case actionKeyHash("basestance"): return value == "basestance" ? 28 : -1;
    case actionKeyHash("batching"): return value == "batching" ? 29 : -1;
    case actionKeyHash("battle"): return value == "battle" ? 30 : -1;
    case actionKeyHash("battleforecast"): return value == "battleforecast" ? 31 : -1;
    case actionKeyHash("battleshout"): return value == "battleshout" ? 32 : -1;
    case actionKeyHash("battlestance"): return value == "battlestance" ? 33 : -1;
    case actionKeyHash("berserkerrage"): return value == "berserkerrage" ? 34 : -1;
    case actionKeyHash("berserkerstance"): return value == "berserkerstance" ? 35 : -1;
    case actionKeyHash("berserking"): return value == "berserking" ? 36 : -1;
    case actionKeyHash("binaryresist"): return value == "binaryresist" ? 37 : -1;
    case actionKeyHash("binaryspell"): return value == "binaryspell" ? 38 : -1;
    case actionKeyHash("blademasterfury"): return value == "blademasterfury" ? 39 : -1;
    case actionKeyHash("bleedbonus"): return value == "bleedbonus" ? 40 : -1;
    case actionKeyHash("bleedmod"): return value == "bleedmod" ? 41 : -1;
    case actionKeyHash("blisteringragehammer"): return value == "blisteringragehammer" ? 42 : -1;
    case actionKeyHash("block"): return value == "block" ? 43 : -1;
    case actionKeyHash("bloodfrenzy"): return value == "bloodfrenzy" ? 44 : -1;
    case actionKeyHash("bloodfury"): return value == "bloodfury" ? 45 : -1;
    case actionKeyHash("bloodlust"): return value == "bloodlust" ? 46 : -1;
    case actionKeyHash("bloodrage"): return value == "bloodrage" ? 47 : -1;
    case actionKeyHash("bloodsurge"): return value == "bloodsurge" ? 48 : -1;
    case actionKeyHash("bloodthirst"): return value == "bloodthirst" ? 49 : -1;
    case actionKeyHash("bonereaver"): return value == "bonereaver" ? 50 : -1;
    case actionKeyHash("bonus"): return value == "bonus" ? 51 : -1;
    case actionKeyHash("bonusdmg"): return value == "bonusdmg" ? 52 : -1;
    case actionKeyHash("boolean"): return value == "boolean" ? 53 : -1;
    case actionKeyHash("castspeed"): return value == "castspeed" ? 54 : -1;
    case actionKeyHash("casttime"): return value == "casttime" ? 55 : -1;
    case actionKeyHash("chance"): return value == "chance" ? 56 : -1;
    case actionKeyHash("chargeblock"): return value == "chargeblock" ? 57 : -1;
    case actionKeyHash("chastise"): return value == "chastise" ? 58 : -1;
    case actionKeyHash("cleave"): return value == "cleave" ? 59 : -1;
    case actionKeyHash("cleavearmor"): return value == "cleavearmor" ? 60 : -1;
    case actionKeyHash("cloudkeeper"): return value == "cloudkeeper" ? 61 : -1;
    case actionKeyHash("coeff"): return value == "coeff" ? 62 : -1;
    case actionKeyHash("coinflip"): return value == "coinflip" ? 63 : -1;
    case actionKeyHash("consumedrage"): return value == "consumedrage" ? 64 : -1;
    case actionKeyHash("cooldown"): return value == "cooldown" ? 65 : -1;
    case actionKeyHash("cost"): return value == "cost" ? 66 : -1;
    case actionKeyHash("count"): return value == "count" ? 67 : -1;
    case actionKeyHash("crit"): return value == "crit" ? 68 : -1;
    case actionKeyHash("critdmgbonus"): return value == "critdmgbonus" ? 69 : -1;
    case actionKeyHash("crusaderzeal"): return value == "crusaderzeal" ? 70 : -1;
    case actionKeyHash("deathwish"): return value == "deathwish" ? 71 : -1;
    case actionKeyHash("deepwounds"): return value == "deepwounds" ? 72 : -1;
    case actionKeyHash("deepwounds2"): return value == "deepwounds2" ? 73 : -1;
    case actionKeyHash("deepwounds3"): return value == "deepwounds3" ? 74 : -1;
    case actionKeyHash("deepwounds4"): return value == "deepwounds4" ? 75 : -1;
    case actionKeyHash("def"): return value == "def" ? 76 : -1;
    case actionKeyHash("defendersresolve"): return value == "defendersresolve" ? 77 : -1;
    case actionKeyHash("defense"): return value == "defense" ? 78 : -1;
    case actionKeyHash("defensivestance"): return value == "defensivestance" ? 79 : -1;
    case actionKeyHash("defforecast"): return value == "defforecast" ? 80 : -1;
    case actionKeyHash("demontaintedblood"): return value == "demontaintedblood" ? 81 : -1;
    case actionKeyHash("devastate"): return value == "devastate" ? 82 : -1;
    case actionKeyHash("dmg"): return value == "dmg" ? 83 : -1;
    case actionKeyHash("dmgmod"): return value == "dmgmod" ? 84 : -1;
    case actionKeyHash("dodge"): return value == "dodge" ? 85 : -1;
    case actionKeyHash("dragonbreath"): return value == "dragonbreath" ? 86 : -1;
    case actionKeyHash("dumpmod"): return value == "dumpmod" ? 87 : -1;
    case actionKeyHash("duration"): return value == "duration" ? 88 : -1;
    case actionKeyHash("earthstrike"): return value == "earthstrike" ? 89 : -1;
    case actionKeyHash("echoes"): return value == "echoes" ? 90 : -1;
    case actionKeyHash("echoesbattle"): return value == "echoesbattle" ? 91 : -1;
    case actionKeyHash("echoesdef"): return value == "echoesdef" ? 92 : -1;
    case actionKeyHash("echoesdread"): return value == "echoesdread" ? 93 : -1;
    case actionKeyHash("echoesglad"): return value == "echoesglad" ? 94 : -1;
    case actionKeyHash("echoeszerk"): return value == "echoeszerk" ? 95 : -1;
    case actionKeyHash("empyrean"): return value == "empyrean" ? 96 : -1;
    case actionKeyHash("enrage"): return value == "enrage" ? 97 : -1;
    case actionKeyHash("eskhandar"): return value == "eskhandar" ? 98 : -1;
    case actionKeyHash("execute"): return value == "execute" ? 99 : -1;
    case actionKeyHash("executeperc"): return value == "executeperc" ? 100 : -1;
    case actionKeyHash("exmacro"): return value == "exmacro" ? 101 : -1;
    case actionKeyHash("expertise"): return value == "expertise" ? 102 : -1;
    case actionKeyHash("exposed"): return value == "exposed" ? 103 : -1;
    case actionKeyHash("extra"): return value == "extra" ? 104 : -1;
    case actionKeyHash("extracritrage"): return value == "extracritrage" ? 105 : -1;
    case actionKeyHash("extrarage"): return value == "extrarage" ? 106 : -1;
    case actionKeyHash("faeriefire"): return value == "faeriefire" ? 107 : -1;
    case actionKeyHash("fireball"): return value == "fireball" ? 108 : -1;
    case actionKeyHash("flask"): return value == "flask" ? 109 : -1;
    case actionKeyHash("flurry"): return value == "flurry" ? 110 : -1;
    case actionKeyHash("forecast"): return value == "forecast" ? 111 : -1;
    case actionKeyHash("freshmeat"): return value == "freshmeat" ? 112 : -1;
    case actionKeyHash("furiousthunder"): return value == "furiousthunder" ? 113 : -1;
    case actionKeyHash("gabbar"): return value == "gabbar" ? 114 : -1;
    case actionKeyHash("gcd"): return value == "gcd" ? 115 : -1;
    case actionKeyHash("glad"): return value == "glad" ? 116 : -1;
    case actionKeyHash("gladforecast"): return value == "gladforecast" ? 117 : -1;
    case actionKeyHash("gladiatorstance"): return value == "gladiatorstance" ? 118 : -1;
    case actionKeyHash("globals"): return value == "globals" ? 119 : -1;
    case actionKeyHash("gneurological"): return value == "gneurological" ? 120 : -1;
    case actionKeyHash("grilekfury"): return value == "grilekfury" ? 121 : -1;
    case actionKeyHash("grilekguard"): return value == "grilekguard" ? 122 : -1;
    case actionKeyHash("gunaxe"): return value == "gunaxe" ? 123 : -1;
    case actionKeyHash("gyromaticacceleration"): return value == "gyromaticacceleration" ? 124 : -1;
    case actionKeyHash("hakkariextra"): return value == "hakkariextra" ? 125 : -1;
    case actionKeyHash("hamstring"): return value == "hamstring" ? 126 : -1;
    case actionKeyHash("handle"): return value == "handle" ? 127 : -1;
    case actionKeyHash("haste"): return value == "haste" ? 128 : -1;
    case actionKeyHash("hategrips"): return value == "hategrips" ? 129 : -1;
    case actionKeyHash("heroicbonus"): return value == "heroicbonus" ? 130 : -1;
    case actionKeyHash("heroicstrike"): return value == "heroicstrike" ? 131 : -1;
    case actionKeyHash("hit"): return value == "hit" ? 132 : -1;
    case actionKeyHash("homunculi"): return value == "homunculi" ? 133 : -1;
    case actionKeyHash("id"): return value == "id" ? 134 : -1;
    case actionKeyHash("impslam"): return value == "impslam" ? 135 : -1;
    case actionKeyHash("interval"): return value == "interval" ? 136 : -1;
    case actionKeyHash("item"): return value == "item" ? 137 : -1;
    case actionKeyHash("jackhammer"): return value == "jackhammer" ? 138 : -1;
    case actionKeyHash("jujuflurry"): return value == "jujuflurry" ? 139 : -1;
    case actionKeyHash("key"): return value == "key" ? 140 : -1;
    case actionKeyHash("keys"): return value == "keys" ? 141 : -1;
    case actionKeyHash("kind"): return value == "kind" ? 142 : -1;
    case actionKeyHash("length"): return value == "length" ? 143 : -1;
    case actionKeyHash("level"): return value == "level" ? 144 : -1;
    case actionKeyHash("links"): return value == "links" ? 145 : -1;
    case actionKeyHash("macearp"): return value == "macearp" ? 146 : -1;
    case actionKeyHash("magicdmg"): return value == "magicdmg" ? 147 : -1;
    case actionKeyHash("magmadarsreturn"): return value == "magmadarsreturn" ? 148 : -1;
    case actionKeyHash("maincd"): return value == "maincd" ? 149 : -1;
    case actionKeyHash("mainspelldmg"): return value == "mainspelldmg" ? 150 : -1;
    case actionKeyHash("masterstrike"): return value == "masterstrike" ? 151 : -1;
    case actionKeyHash("maxdelay"): return value == "maxdelay" ? 152 : -1;
    case actionKeyHash("maxdmg"): return value == "maxdmg" ? 153 : -1;
    case actionKeyHash("maxrage"): return value == "maxrage" ? 154 : -1;
    case actionKeyHash("meltarmor"): return value == "meltarmor" ? 155 : -1;
    case actionKeyHash("mh"): return value == "mh" ? 156 : -1;
    case actionKeyHash("mhthreshold"): return value == "mhthreshold" ? 157 : -1;
    case actionKeyHash("mightyragepotion"): return value == "mightyragepotion" ? 158 : -1;
    case actionKeyHash("mildlyirradiated"): return value == "mildlyirradiated" ? 159 : -1;
    case actionKeyHash("mindmg"): return value == "mindmg" ? 160 : -1;
    case actionKeyHash("minrage"): return value == "minrage" ? 161 : -1;
    case actionKeyHash("misschance"): return value == "misschance" ? 162 : -1;
    case actionKeyHash("mitigation"): return value == "mitigation" ? 163 : -1;
    case actionKeyHash("moddmgdone"): return value == "moddmgdone" ? 164 : -1;
    case actionKeyHash("moddmgtaken"): return value == "moddmgtaken" ? 165 : -1;
    case actionKeyHash("mode"): return value == "mode" ? 166 : -1;
    case actionKeyHash("modifier"): return value == "modifier" ? 167 : -1;
    case actionKeyHash("modrag"): return value == "modrag" ? 168 : -1;
    case actionKeyHash("moltenemberstone"): return value == "moltenemberstone" ? 169 : -1;
    case actionKeyHash("moonstalkerfury"): return value == "moonstalkerfury" ? 170 : -1;
    case actionKeyHash("mortalstrike"): return value == "mortalstrike" ? 171 : -1;
    case actionKeyHash("name"): return value == "name" ? 172 : -1;
    case actionKeyHash("nocrit"): return value == "nocrit" ? 173 : -1;
    case actionKeyHash("noitemcd"): return value == "noitemcd" ? 174 : -1;
    case actionKeyHash("null"): return value == "null" ? 175 : -1;
    case actionKeyHash("number"): return value == "number" ? 176 : -1;
    case actionKeyHash("object"): return value == "object" ? 177 : -1;
    case actionKeyHash("obsidianhaste"): return value == "obsidianhaste" ? 178 : -1;
    case actionKeyHash("obsidianstrength"): return value == "obsidianstrength" ? 179 : -1;
    case actionKeyHash("offensive"): return value == "offensive" ? 180 : -1;
    case actionKeyHash("offhand"): return value == "offhand" ? 181 : -1;
    case actionKeyHash("offhit"): return value == "offhit" ? 182 : -1;
    case actionKeyHash("oh"): return value == "oh" ? 183 : -1;
    case actionKeyHash("overpower"): return value == "overpower" ? 184 : -1;
    case actionKeyHash("overpowercrit"): return value == "overpowercrit" ? 185 : -1;
    case actionKeyHash("overpowerrend"): return value == "overpowerrend" ? 186 : -1;
    case actionKeyHash("parse"): return value == "parse" ? 187 : -1;
    case actionKeyHash("phantom"): return value == "phantom" ? 188 : -1;
    case actionKeyHash("physdmg"): return value == "physdmg" ? 189 : -1;
    case actionKeyHash("player"): return value == "player" ? 190 : -1;
    case actionKeyHash("potentvenoms"): return value == "potentvenoms" ? 191 : -1;
    case actionKeyHash("potentvenoms2"): return value == "potentvenoms2" ? 192 : -1;
    case actionKeyHash("proc1"): return value == "proc1" ? 193 : -1;
    case actionKeyHash("proc2"): return value == "proc2" ? 194 : -1;
    case actionKeyHash("procblock"): return value == "procblock" ? 195 : -1;
    case actionKeyHash("procs"): return value == "procs" ? 196 : -1;
    case actionKeyHash("props"): return value == "props" ? 197 : -1;
    case actionKeyHash("pummel"): return value == "pummel" ? 198 : -1;
    case actionKeyHash("pummeler"): return value == "pummeler" ? 199 : -1;
    case actionKeyHash("quicknesspotion"): return value == "quicknesspotion" ? 200 : -1;
    case actionKeyHash("quickstrike"): return value == "quickstrike" ? 201 : -1;
    case actionKeyHash("rage"): return value == "rage" ? 202 : -1;
    case actionKeyHash("rageblock"): return value == "rageblock" ? 203 : -1;
    case actionKeyHash("ragecap"): return value == "ragecap" ? 204 : -1;
    case actionKeyHash("rageconversion"): return value == "rageconversion" ? 205 : -1;
    case actionKeyHash("ragehammer"): return value == "ragehammer" ? 206 : -1;
    case actionKeyHash("ragemod"): return value == "ragemod" ? 207 : -1;
    case actionKeyHash("ragepotion"): return value == "ragepotion" ? 208 : -1;
    case actionKeyHash("rageretained"): return value == "rageretained" ? 209 : -1;
    case actionKeyHash("ragingblow"): return value == "ragingblow" ? 210 : -1;
    case actionKeyHash("rampage"): return value == "rampage" ? 211 : -1;
    case actionKeyHash("reactionmax"): return value == "reactionmax" ? 212 : -1;
    case actionKeyHash("reactionmin"): return value == "reactionmin" ? 213 : -1;
    case actionKeyHash("recklessness"): return value == "recklessness" ? 214 : -1;
    case actionKeyHash("refund"): return value == "refund" ? 215 : -1;
    case actionKeyHash("relentlessstrength"): return value == "relentlessstrength" ? 216 : -1;
    case actionKeyHash("rend"): return value == "rend" ? 217 : -1;
    case actionKeyHash("resolve"): return value == "resolve" ? 218 : -1;
    case actionKeyHash("rivenspike"): return value == "rivenspike" ? 219 : -1;
    case actionKeyHash("roarguardian"): return value == "roarguardian" ? 220 : -1;
    case actionKeyHash("school"): return value == "school" ? 221 : -1;
    case actionKeyHash("secondarystance"): return value == "secondarystance" ? 222 : -1;
    case actionKeyHash("seed"): return value == "seed" ? 223 : -1;
    case actionKeyHash("shield"): return value == "shield" ? 224 : -1;
    case actionKeyHash("shieldrender"): return value == "shieldrender" ? 225 : -1;
    case actionKeyHash("shieldslam"): return value == "shieldslam" ? 226 : -1;
    case actionKeyHash("shockwave"): return value == "shockwave" ? 227 : -1;
    case actionKeyHash("sim"): return value == "sim" ? 228 : -1;
    case actionKeyHash("singleminded"): return value == "singleminded" ? 229 : -1;
    case actionKeyHash("skill_"): return value == "skill_" ? 230 : -1;
    case actionKeyHash("slam"): return value == "slam" ? 231 : -1;
    case actionKeyHash("slammainreset"): return value == "slammainreset" ? 232 : -1;
    case actionKeyHash("slayer"): return value == "slayer" ? 233 : -1;
    case actionKeyHash("sod"): return value == "sod" ? 234 : -1;
    case actionKeyHash("speed"): return value == "speed" ? 235 : -1;
    case actionKeyHash("spell"): return value == "spell" ? 236 : -1;
    case actionKeyHash("spellcrit"): return value == "spellcrit" ? 237 : -1;
    case actionKeyHash("spelldamage"): return value == "spelldamage" ? 238 : -1;
    case actionKeyHash("spelldmgmod"): return value == "spelldmgmod" ? 239 : -1;
    case actionKeyHash("spellqueueing"): return value == "spellqueueing" ? 240 : -1;
    case actionKeyHash("spells"): return value == "spells" ? 241 : -1;
    case actionKeyHash("spicy"): return value == "spicy" ? 242 : -1;
    case actionKeyHash("spider"): return value == "spider" ? 243 : -1;
    case actionKeyHash("stance"): return value == "stance" ? 244 : -1;
    case actionKeyHash("stanceswitch"): return value == "stanceswitch" ? 245 : -1;
    case actionKeyHash("startrage"): return value == "startrage" ? 246 : -1;
    case actionKeyHash("stats"): return value == "stats" ? 247 : -1;
    case actionKeyHash("stoneslayer"): return value == "stoneslayer" ? 248 : -1;
    case actionKeyHash("str"): return value == "str" ? 249 : -1;
    case actionKeyHash("string"): return value == "string" ? 250 : -1;
    case actionKeyHash("strmod"): return value == "strmod" ? 251 : -1;
    case actionKeyHash("suddendeath"): return value == "suddendeath" ? 252 : -1;
    case actionKeyHash("sunderarmor"): return value == "sunderarmor" ? 253 : -1;
    case actionKeyHash("swarmguard"): return value == "swarmguard" ? 254 : -1;
    case actionKeyHash("swingpercent"): return value == "swingpercent" ? 255 : -1;
    case actionKeyHash("swingtimer"): return value == "swingtimer" ? 256 : -1;
    case actionKeyHash("swingtimerless"): return value == "swingtimerless" ? 257 : -1;
    case actionKeyHash("switchdefault"): return value == "switchdefault" ? 258 : -1;
    case actionKeyHash("switchdelay"): return value == "switchdelay" ? 259 : -1;
    case actionKeyHash("switchechoesactive"): return value == "switchechoesactive" ? 260 : -1;
    case actionKeyHash("switchechoesrage"): return value == "switchechoesrage" ? 261 : -1;
    case actionKeyHash("switchechoestime"): return value == "switchechoestime" ? 262 : -1;
    case actionKeyHash("switchoractive"): return value == "switchoractive" ? 263 : -1;
    case actionKeyHash("switchorrage"): return value == "switchorrage" ? 264 : -1;
    case actionKeyHash("switchortime"): return value == "switchortime" ? 265 : -1;
    case actionKeyHash("switchrage"): return value == "switchrage" ? 266 : -1;
    case actionKeyHash("switchstart"): return value == "switchstart" ? 267 : -1;
    case actionKeyHash("switchtime"): return value == "switchtime" ? 268 : -1;
    case actionKeyHash("switchtimeactive"): return value == "switchtimeactive" ? 269 : -1;
    case actionKeyHash("switchto"): return value == "switchto" ? 270 : -1;
    case actionKeyHash("swordboard"): return value == "swordboard" ? 271 : -1;
    case actionKeyHash("swordproc"): return value == "swordproc" ? 272 : -1;
    case actionKeyHash("talents"): return value == "talents" ? 273 : -1;
    case actionKeyHash("target"): return value == "target" ? 274 : -1;
    case actionKeyHash("tasteforblood"): return value == "tasteforblood" ? 275 : -1;
    case actionKeyHash("tempest"): return value == "tempest" ? 276 : -1;
    case actionKeyHash("tfbstep"): return value == "tfbstep" ? 277 : -1;
    case actionKeyHash("themoltencore"): return value == "themoltencore" ? 278 : -1;
    case actionKeyHash("thunderclap"): return value == "thunderclap" ? 279 : -1;
    case actionKeyHash("tickdmg"): return value == "tickdmg" ? 280 : -1;
    case actionKeyHash("timer"): return value == "timer" ? 281 : -1;
    case actionKeyHash("timesecsmax"): return value == "timesecsmax" ? 282 : -1;
    case actionKeyHash("timesecsmin"): return value == "timesecsmin" ? 283 : -1;
    case actionKeyHash("timetoend"): return value == "timetoend" ? 284 : -1;
    case actionKeyHash("timetostart"): return value == "timetostart" ? 285 : -1;
    case actionKeyHash("timeworn"): return value == "timeworn" ? 286 : -1;
    case actionKeyHash("trinketproc1"): return value == "trinketproc1" ? 287 : -1;
    case actionKeyHash("trinketproc2"): return value == "trinketproc2" ? 288 : -1;
    case actionKeyHash("turtle"): return value == "turtle" ? 289 : -1;
    case actionKeyHash("twohand"): return value == "twohand" ? 290 : -1;
    case actionKeyHash("type"): return value == "type" ? 291 : -1;
    case actionKeyHash("ultrasonic"): return value == "ultrasonic" ? 292 : -1;
    case actionKeyHash("umbridledwrath"): return value == "umbridledwrath" ? 293 : -1;
    case actionKeyHash("unqueue"): return value == "unqueue" ? 294 : -1;
    case actionKeyHash("unqueuetimer"): return value == "unqueuetimer" ? 295 : -1;
    case actionKeyHash("unrelentingstrikes"): return value == "unrelentingstrikes" ? 296 : -1;
    case actionKeyHash("unstoppablemight"): return value == "unstoppablemight" ? 297 : -1;
    case actionKeyHash("useonly"): return value == "useonly" ? 298 : -1;
    case actionKeyHash("usestep"): return value == "usestep" ? 299 : -1;
    case actionKeyHash("vaelbuff"): return value == "vaelbuff" ? 300 : -1;
    case actionKeyHash("value"): return value == "value" ? 301 : -1;
    case actionKeyHash("value1"): return value == "value1" ? 302 : -1;
    case actionKeyHash("value2"): return value == "value2" ? 303 : -1;
    case actionKeyHash("version"): return value == "version" ? 304 : -1;
    case actionKeyHash("vibroblade"): return value == "vibroblade" ? 305 : -1;
    case actionKeyHash("victoryrush"): return value == "victoryrush" ? 306 : -1;
    case actionKeyHash("voidmadness"): return value == "voidmadness" ? 307 : -1;
    case actionKeyHash("voodoofrenzy"): return value == "voodoofrenzy" ? 308 : -1;
    case actionKeyHash("wailingextra"): return value == "wailingextra" ? 309 : -1;
    case actionKeyHash("weapon"): return value == "weapon" ? 310 : -1;
    case actionKeyHash("weaponbleedmh"): return value == "weaponbleedmh" ? 311 : -1;
    case actionKeyHash("weaponbleedoh"): return value == "weaponbleedoh" ? 312 : -1;
    case actionKeyHash("weapons"): return value == "weapons" ? 313 : -1;
    case actionKeyHash("weaponspell"): return value == "weaponspell" ? 314 : -1;
    case actionKeyHash("whirlwind"): return value == "whirlwind" ? 315 : -1;
    case actionKeyHash("worgenmark"): return value == "worgenmark" ? 316 : -1;
    case actionKeyHash("wrathwray"): return value == "wrathwray" ? 317 : -1;
    case actionKeyHash("wreckingcrew"): return value == "wreckingcrew" ? 318 : -1;
    case actionKeyHash("wwcd"): return value == "wwcd" ? 319 : -1;
    case actionKeyHash("zandalarian"): return value == "zandalarian" ? 320 : -1;
    case actionKeyHash("zeal"): return value == "zeal" ? 321 : -1;
    case actionKeyHash("zerk"): return value == "zerk" ? 322 : -1;
    case actionKeyHash("zerkerpriority"): return value == "zerkerpriority" ? 323 : -1;
    case actionKeyHash("zerkforecast"): return value == "zerkforecast" ? 324 : -1;
    default: return -1;
    }
}

struct KnownAction {
    int index;
    explicit constexpr KnownAction(std::string_view value) : index(actionKeyIndex(value)) {}
    template<std::size_t N>
    explicit consteval KnownAction(const char (&value)[N]) : index(actionKeyIndex(std::string_view(value, N - 1))) {
        if (index < 0) throw "unknown native simulation action";
    }
};

} // namespace warriorsim::detail

namespace warriorsim {

consteval detail::KnownAction operator""_action(const char* value, std::size_t size) {
    const auto key = detail::KnownAction{std::string_view(value, size)};
    if (key.index < 0) throw "unknown native simulation action";
    return key;
}

} // namespace warriorsim
