var runes = {
   "chest": [
      {
         id: 900001,
         name: 'Flagellation',
         description: "Gain a 25% bonus to physical damage done for 12 sec after activating Bloodrage or Berserker Rage.",
         iconname: 'Flagellation',
         flagellation: true,
     },
     {
         id: 900002,
         name: 'Blood Frenzy',
         description: "Each time you deal Bleed damage, you gain 3 rage.",
         iconname: 'Blood-Frenzy',
         bleedrage: 3,
     },
     {
         id: 900003,
         name: 'Raging Blow',
         description: "A ferocious strike that deals 100% weapon damage, but can only be used while Enrage, Berserker Rage, or Bloodrage is active. [ASSUMED 6 SECOND CD AND 10 RAGE COST]",
         iconname: 'Raging-Blow',
         enable: 900003
     },
     {
         id: 900004,
         name: 'Warbringer',
         description: "Your Charge, Intercept, and Intervene abilities are now usable while in combat and in any stance, and will all remove movement impairing effects when activated.",
         iconname: 'Warbringer',
     },
   ],
   "hands": [
      {
         id: 900005,
         name: 'Furious Thunder',
         description: "Thunder Clap now increases the time between attacks by an additional 6% and can be used in any stance.",
         iconname: 'Furious-Thunder',
     },
     {
         id: 900006,
         name: 'Consumed by Rage',
         description: "Enrages you and grants you a 25% melee damage bonus for 12 sec or up to a maximum of 12 swings after you exceed 80 Rage. [ASSUMED NO COOLDOWN]",
         iconname: 'Consumed-by-Rage',
         enable: 900006,
     },
     {
         id: 900007,
         name: 'Frenzied Assault',
         description: "While wielding 2-handed weapons, your attack speed is increased by 20%.",
         iconname: 'Frenzied-Assault',
         haste2h: 20,
     },
   ],
   "legs": [
      {
         id: 900008,
         name: 'Victory Rush',
         description: "Instantly attack the target causing (Attack power * 45 / 100) damage and healing you for 10% of your maximum health. Only usable within 20 sec after you kill an enemy that yields experience or honor.",
         iconname: 'Victory-Rush',
         enable: 900008,
     },
     {
         id: 900009,
         name: 'Endless Rage',
         description: "You generate 25% more Rage from all damage you deal.",
         iconname: 'Endless-Rage',
         ragemod: 1.25,
     },
     {
         id: 900010,
         name: 'Devastate',
         description: "NOT IMPLEMENTED - While you are in Defensive Stance and have a shield equipped, Sunder Armor also deals 100% weapon damage, increased by 10% per application of Sunder Armor already on the target.",
         iconname: 'Devastate',
     },
     {
         id: 900011,
         name: 'Single-Minded Fury',
         description: "While dual-wielding, your Physical damage and movement speed are increased by 10%.",
         iconname: 'Single-Minded-Fury',
         dmgdw: 10
     },
     {
         id: 900012,
         name: 'Quick Strike',
         description: "NOT IMPLEMENTED - SPELL - A reckless instant melee attack with your two-handed weapon dealing 50 to 83 physical damage. This ability benefits from and triggers all effects associated with Heroic Strike.",
         iconname: 'inv_axe_03',
     },
   ],
};
