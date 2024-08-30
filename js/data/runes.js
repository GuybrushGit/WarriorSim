var runes = {
   "chest": [
      {
         id: 402877,
         name: 'Flagellation',
         description: "Gain a 25% bonus to physical damage done for 12 sec after activating Bloodrage or Berserker Rage.",
         iconname: 'ability_warrior_intensifyrage',
         flagellation: true,
     },
     {
         id: 412507,
         name: 'Blood Frenzy',
         description: "Each time you deal Bleed damage, you gain 3 rage.",
         iconname: 'ability_warrior_bloodfrenzy',
         bloodfrenzy: true,
     },
     {
         id: 402911,
         name: 'Raging Blow',
         description: "A ferocious strike that deals 100% weapon damage, but can only be used while Enrage, Berserker Rage, or Bloodrage is active.",
         iconname: 'ability_hunter_swiftstrike',
         enable: 402911
     },
     {
         id: 425421,
         name: 'Warbringer',
         description: "Your Charge, Intercept, and Intervene abilities are now usable while in combat and in any stance, and will all remove movement impairing effects when activated.",
         iconname: 'ability_warrior_warbringer',
     },
   ],
   "legs": [
      {
         id: 403219,
         name: 'Furious Thunder',
         description: "Thunder Clap now increases the time between attacks by an additional 6%, can be used in any stance, deals 100% increased damage, and deals 50% increased threat.",
         iconname: 'ability_thunderclap',
         furiousthunder: true,
     },
     {
         id: 425418,
         name: 'Consumed by Rage',
         description: "Enrages you and grants you a 25% melee damage bonus for 12 sec or up to a maximum of 12 swings after you exceed 80 Rage.",
         iconname: 'spell_nature_shamanrage',
         enable: 425418,
     },
     {
         id: 431046,
         name: 'Frenzied Assault',
         description: "While wielding 2-handed weapons, your attack speed is increased by 20%.",
         iconname: 'ability_warrior_unrelentingassault',
         haste2h: 30,
     }
   ],
   "hands": [
      {
         id: 402927,
         name: 'Victory Rush',
         description: "Instantly attack the target causing Attack power * 45 / 100 damage and healing you for 10% of your maximum health. Only usable within 20 sec after you kill an enemy that yields experience or honor.",
         iconname: 'ability_warrior_devastate',
         enable: 402927,
     },
     {
         id: 403195,
         name: 'Devastate',
         description: "While you are in Defensive Stance and have a shield equipped, Sunder Armor also deals 100% weapon damage, increased by 10% per application of Sunder Armor already on the target.",
         iconname: 'inv_sword_11',
         devastate: true,
     },
     {
         id: 413404,
         name: 'Single-Minded Fury',
         description: "While dual-wielding, your Physical damage and movement speed are increased by 10%.",
         iconname: 'ability_warrior_incite',
         singleminded: true,
     },
     {
         id: 429765,
         name: 'Quick Strike',
         description: "A reckless instant melee attack with your two-handed weapon dealing (Attack power * 15 / 100) to (Attack power * 25 / 100) physical damage. This ability benefits from and triggers all effects associated with Heroic Strike.<BR/>[DONT REALLY KNOW HOW THIS WORKS DOES IT INTERACT WITH HS QUEUE?]",
         iconname: 'inv_axe_03',
         twohandonly: true,
         enable: 429765,
     },
   ],
   "waist": [
        {
            id: 413380,
            name: 'Blood Surge',
            description: "",
            iconname: 'ability_warrior_bloodsurge',
            bloodsurge: true,
        },
        {
            id: 29787,
            name: 'Focused Rage',
            description: "",
            iconname: 'ability_warrior_focusedrage',
            focusedrage: true,
        },
        {
            id: 402922,
            name: 'Precise Timing',
            description: "",
            iconname: 'inv_misc_pocketwatch_02',
            precisetiming: true,
        },
    ],
    "feet": [
        {
            id: 426490,
            name: 'Rallying Cry',
            description: "",
            iconname: 'ability_warrior_commandingshout',
        },
        {
            id: 402913,
            name: 'Enraged Regeneration',
            description: "",
            iconname: 'ability_hunter_harass',
        },
        {
            id: 403338,
            name: 'Intervene',
            description: "",
            iconname: 'ability_warrior_victoryrush',
        },
        {
            id: 413479,
            name: 'Gladiator Stance',
            description: "",
            iconname: 'achievement_featsofstrength_gladiator_08',
            gladstance: true,
            enable: 413479,
            buffgroup: 'stance'
        },
    ],
    "wrist": [
        {
            id: 427070,
            name: 'Rampage',
            description: "",
            iconname: 'ability_warrior_rampage',
            enable: 427070,
        },
        {
            id: 426978,
            name: 'Sword and Board',
            description: "",
            iconname: 'ability_warrior_swordandboard',
            swordboard: true,
        },
        {
            id: 427065,
            name: 'Wrecking Crew',
            description: "",
            iconname: 'ability_warrior_trauma',
            wreckingcrew: true,
        },
    ],
    "head": [
        {
            id: 426980,
            name: 'Shield Mastery',
            description: "",
            iconname: 'ability_warrior_shieldguard',
            dmgshield: 10
        },
        {
            id: 426953,
            name: 'Taste for Blood',
            description: "",
            iconname: 'ability_rogue_hungerforblood',
            tasteforblood: true,
        },
        {
            id: 426972,
            name: 'Vigilance',
            description: "",
            iconname: 'ability_warrior_vigilance',
        },
        {
            id: 403218,
            name: 'Endless Rage',
            description: "You generate 25% more Rage from all damage you deal.<br />[ASSUMED NO EFFECT ON REFUNDS]",
            iconname: 'ability_warrior_endlessrage',
            ragemod: 1.25,
        },
    ],
    "back": [
        {
            id: 440484,
            name: 'Fresh Meat',
            description: "",
            iconname: 'spell_deathknight_butcher',
            freshmeat: true,
        },
        {
            id: 440113,
            name: 'Sudden Death',
            description: "",
            iconname: 'ability_warrior_improveddisciplines',
            suddendeath: true,
        },
        {
            id: 440488,
            name: 'Shockwave',
            description: "",
            iconname: 'ability_warrior_shockwave',
            enable: 440488,
        },
    ],
};
