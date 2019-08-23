var buffs = [
   {
      name: "Battle Shout",
      iconname: "Ability_Warrior_BattleShout",
      description: "The warrior shouts, increasing the melee attack power of all party members within 20 yards by 185. Lasts 2 min.",
      group: "battleshout",
      ap: 185,
      checked: true,
      disableSpell: "battleshout"
   },
   {
      name: "Rallying Cry of the Dragonslayer",
      iconname: "inv_misc_head_dragon_01",
      description: "Increases critical chance of spells by 10%, melee and ranged by 5% and grants 140 attack power. 120 minute duration.",
      group: "",
      ap: 140,
      crit: 5,
      checked: true
   },
   {
      name: "Spirit of Zandalar",
      iconname: "ability_creature_poison_05",
      description: "Increases movement speed by 10% and all stats by 15% for 2 hours.",
      group: "",
      strmod: 15,
      agimod: 15,
      checked: true
   },
   {
      name: "Sayge's Dark Fortune of Damage",
      iconname: "inv_misc_orb_02",
      description: "10% Damage",
      group: "darkfortune",
      dmgmod: 10,
   },
   {
      name: "Sayge's Dark Fortune of Strength",
      iconname: "inv_misc_orb_02",
      description: "10% Strength",
      group: "darkfortune",
      strmod: 10,
   },
   {
      name: "Fengus' Ferocity",
      iconname: "spell_nature_undyingstrength",
      description: "Attack power increased by 200.",
      group: "",
      ap: 200,
   },
   {
      name: "Songflower Serenade",
      iconname: "spell_holy_mindvision",
      description: "Increases chance for a melee, ranged, or spell critical by 5% and all attributes by 15 for 1 hr.",
      group: "",
      crit: 5, 
      str: 15, 
      agi: 15,
   },
   {
      name: "Warchief's Blessing",
      iconname: "spell_arcane_teleportorgrimmar",
      description: "Increases hitpoints by 300. 15% haste to melee attacks. 10 mana regen every 5 seconds.",
      group: "",
      haste: 15,
   },
   {
      name: "R.O.I.D.S.",
      iconname: "inv_stone_15",
      description: "Increases Strength by 25 when consumed. Effect lasts for 60 minutes.",
      group: "",
      str: 25,
   },
   {
      name: "Ground Scorpok Assay",
      iconname: "inv_misc_dust_02",
      description: "Increases Agility by 25 when consumed. Effect lasts for 60 minutes.",
      group: "",
      agi: 25,
   },
   {
      name: "Elixir of the Mongoose",
      iconname: "inv_potion_32",
      description: "Increases Agility by 25 and chance to get a critical hit by 2% for 1 hr.",
      group: "elixir",
      agi: 25,
      crit: 2,
      checked: true
   },
   {
      name: "Elixir of Greater Agility",
      iconname: "inv_potion_94",
      description: "Increases Agility by 25 for 1 hr.",
      group: "elixir",
      agi: 25
   },
   {
      name: "Juju Power",
      iconname: "inv_misc_monsterscales_11",
      description: "Increases the target's Strength by 30 for 30 min.",
      group: "str",
      str: 30
   },
   {
      name: "Elixir of Giants",
      iconname: "inv_potion_61",
      description: "Increases your Strength by 25 for 1 hr.",
      group: "str",
      str: 25,
      checked: true
   },
   {
      name: "Juju Might",
      iconname: "inv_misc_monsterscales_07",
      description: "Increases attack power by 40 for 10 min.",
      group: "ap",
      ap: 40
   },
   {
      name: "Winterfall Firewater",
      iconname: "inv_potion_92",
      description: "Increases your melee attack power by 35 and size for 20 min.",
      group: "ap",
      ap: 35
   },
   {
      name: "Smoked Desert Dumplings",
      iconname: "inv_misc_food_64",
      description: "Restores 2148 health over 30 sec. Must remain seated while eating. If you spend at least 10 seconds eating you will become well fed and gain 20 Strength for 15 min.",
      group: "food",
      str: 20
   },
   {
      name: "Grilled Squid",
      iconname: "inv_misc_fish_13",
      description: "Restores 874.8 health over 27 sec. Must remain seated while eating. If you eat for 10 seconds will also increase your Agility by 10 for 10 min.",
      group: "food",
      agi: 10
   },
   {
      name: "Blessed Sunfruit",
      iconname: "inv_misc_food_41",
      description: "Restores 1933.2 health over 27 sec. Must remain seated while eating. Also increases your Strength by 10 for 10 min.",
      group: "food",
      str: 10
   },
   {
      name: "Juju Flurry",
      iconname: "inv_misc_monsterscales_17",
      description: "Increases the target's attack speed by 3% for 20 sec.",
      spell: "JujuFlurry",
   },
   {
      name: "Mighty Rage Potion",
      iconname: "inv_potion_41",
      description: "Increases Rage by 45 to 75 and increases Strength by 60 for 20 sec.",
      spell: "RagePotion",
   },
   
   // TODO

   //    name: "Elemental Sharpening Stone",
   //    iconname: "inv_stone_02",
   //    description: "Increase critical chance on a melee weapon by 2% for 30 minutes.",
   //    group: "stone",
   // },
   // {
   //    name: "Dense Stone",
   //    iconname: "inv_stone_sharpeningstone_05",
   //    description: "Increase weapon damage by 8 for 30 minutes.",
   //    group: "stone",
   // },
];


function buildBuffs() {
   let article = $('article.buffs');
   for(let buff of buffs) {
      let div = $('<div class="buff"><img src="img/' + buff.iconname + '.jpg" alt="' + buff.name + '"><div class="tooltip"><p>' + buff.name + '</p><p class="description">' + buff.description + '</p></div></div>');
      div.attr('data-group', buff.group);
      div.attr('data-ap', buff.ap);
      div.attr('data-crit', buff.crit);
      div.attr('data-agi', buff.agi);
      div.attr('data-str', buff.str);
      div.attr('data-agimod', buff.agimod);
      div.attr('data-strmod', buff.strmod);
      div.attr('data-dmgmod', buff.dmgmod);
      div.attr('data-haste', buff.haste);
      if (buff.spell) div.attr('data-spell', buff.spell);
      if (buff.disableSpell) div.attr('data-disable-spell', buff.disableSpell);
      if (buff.checked) div.addClass('active');
      div.click(function() {
         let b = $(this);
         b.toggleClass('active');
         if (b.hasClass('active')) {
            if (b.data('group'))
               b.siblings().filter('[data-group="' + b.data('group') + '"]').removeClass('active');
            if (b.data('disable-spell'))
               $('.spell[data-id="' + b.data('disable-spell') + '"]').removeClass('active');
         }
      });
      article.append(div);
   }

}