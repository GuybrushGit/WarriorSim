var buffs = [
   {
      id: 27578,
      spellid: true,
      name: "Battle Shout",
      iconname: "Ability_Warrior_BattleShout",
      group: "battleshout",
      ap: 185,
      checked: true,
      disableSpell: "battleshout"
   },
   {
      id: 22888,
      spellid: true,
      name: "Rallying Cry of the Dragonslayer",
      iconname: "inv_misc_head_dragon_01",
      group: "",
      ap: 140,
      crit: 5,
      checked: true
   },
   {
      id: 24425,
      spellid: true,
      name: "Spirit of Zandalar",
      iconname: "ability_creature_poison_05",
      group: "",
      strmod: 15,
      agimod: 15,
      checked: true
   },
   {
      id: 23768,
      spellid: true,
      name: "Sayge's Dark Fortune of Damage",
      iconname: "inv_misc_orb_02",
      group: "darkfortune",
      dmgmod: 10,
   },
   {
      id: 23735,
      spellid: true,
      name: "Sayge's Dark Fortune of Strength",
      iconname: "inv_misc_orb_02",
      group: "darkfortune",
      strmod: 10,
   },
   {
      id: 22817,
      spellid: true,
      name: "Fengus' Ferocity",
      iconname: "spell_nature_undyingstrength",
      group: "",
      ap: 200,
   },
   {
      id: 15366,
      spellid: true,
      name: "Songflower Serenade",
      iconname: "spell_holy_mindvision",
      group: "",
      crit: 5,
      str: 15,
      agi: 15,
   },
   {
      id: 16609,
      spellid: true,
      name: "Warchief's Blessing",
      iconname: "spell_arcane_teleportorgrimmar",
      group: "",
      haste: 15,
   },
   {
      id: 17007,
      spellid: true,
      name: "Leader of the Pack",
      iconname: "spell_nature_unyeildingstamina",
      group: "",
      crit: 3,
   },
   {
      id: 9885,
      spellid: true,
      name: "Mark of the Wild",
      iconname: "spell_nature_regeneration",
      group: "",
      str: 12,
      agi: 12
   },
   {
      id: 20906,
      spellid: true,
      name: "Trueshot Aura",
      iconname: "ability_trueshot",
      group: "",
      ap: 100
   },
   {
      id: 20217,
      spellid: true,
      name: "Blessing of Kings",
      iconname: "spell_magic_magearmor",
      group: "",
      strmod: 10,
      agimod: 10
   },
   {
      id: 19838,
      spellid: true,
      name: "Blessing of Might",
      iconname: "spell_holy_fistofjustice",
      group: "",
      ap: 155
   },
   {
      id: 10627,
      spellid: true,
      name: "Grace of Air Totem",
      iconname: "spell_nature_invisibilitytotem",
      group: "",
      agi: 67
   },
   {
      id: 10442,
      spellid: true,
      name: "Strength of Earth Totem",
      iconname: "spell_nature_earthbindtotem",
      group: "",
      str: 61
   },
   {
      id: 8410,
      name: "R.O.I.D.S.",
      iconname: "inv_stone_15",
      group: "",
      str: 25,
   },
   {
      id: 8412,
      name: "Ground Scorpok Assay",
      iconname: "inv_misc_dust_02",
      group: "",
      agi: 25,
   },
   {
      id: 13452,
      name: "Elixir of the Mongoose",
      iconname: "inv_potion_32",
      group: "elixir",
      agi: 25,
      crit: 2,
      checked: true
   },
   {
      id: 9187,
      name: "Elixir of Greater Agility",
      iconname: "inv_potion_94",
      group: "elixir",
      agi: 25
   },
   {
      id: 12451,
      name: "Juju Power",
      iconname: "inv_misc_monsterscales_11",
      group: "str",
      str: 30
   },
   {
      id: 9206,
      name: "Elixir of Giants",
      iconname: "inv_potion_61",
      group: "str",
      str: 25,
      checked: true
   },
   {
      id: 12460,
      name: "Juju Might",
      iconname: "inv_misc_monsterscales_07",
      group: "ap",
      ap: 40
   },
   {
      id: 12820,
      name: "Winterfall Firewater",
      iconname: "inv_potion_92",
      group: "ap",
      ap: 35
   },
   {
      id: 20452,
      name: "Smoked Desert Dumplings",
      iconname: "inv_misc_food_64",
      group: "food",
      str: 20
   },
   {
      id: 13928,
      name: "Grilled Squid",
      iconname: "inv_misc_fish_13",
      group: "food",
      agi: 10
   },
   {
      id: 13810,
      name: "Blessed Sunfruit",
      iconname: "inv_misc_food_41",
      group: "food",
      str: 10
   },
   {
      id: 12450,
      name: "Juju Flurry",
      iconname: "inv_misc_monsterscales_17",
      spell: "JujuFlurry",
   },
   {
      id: 13442,
      name: "Mighty Rage Potion",
      iconname: "inv_potion_41",
      spell: "RagePotion",
   },
];


function buildBuffs() {
   let article = $('article.buffs');
   for (let buff of buffs) {
      let div = $('<div class="buff"><img src="img/' + buff.iconname + '.jpg" alt="' + buff.name + '"></div>');
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
      div.click(function () {
         let b = $(this);
         b.toggleClass('active');
         if (b.hasClass('active')) {
            if (b.data('group'))
               b.siblings().filter('[data-group="' + b.data('group') + '"]').removeClass('active');
            if (b.data('disable-spell'))
               $('.spell[data-id="' + b.data('disable-spell') + '"]').removeClass('active');
         }
         updatePanel();
      });
      div.append('<a href="https://classic.wowhead.com/' + (buff.spellid ? 'spell' : 'item') + '=' + buff.id + '" class="wh-tooltip"></a>');
      article.append(div);
   }

}