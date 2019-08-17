var buffs = [
   {
      name: "Rallying Cry of the Dragonslayer",
      iconname: "inv_misc_head_dragon_01",
      description: "Increases critical chance of spells by 10%, melee and ranged by 5% and grants 140 attack power. 120 minute duration.",
      group: "",
      aura: new Aura(9999, { ap: 140, crit: 5 })
   },
   {
      name: "Spirit of Zandalar",
      iconname: "ability_creature_poison_05",
      description: "Increases movement speed by 10% and all stats by 15% for 2 hours.",
      group: "",
      aura: new Aura(9999, {  })
   },
   {
      name: "Sayge's Dark Fortune of Damage",
      iconname: "inv_misc_orb_02",
      description: "1-10% Damage",
      group: "darkfortune",
      aura: new Aura(9999, {  })
   },
   {
      name: "Sayge's Dark Fortune of Strength",
      iconname: "inv_misc_orb_02",
      description: "10% Strength",
      group: "darkfortune",
      aura: new Aura(9999, {  })
   },
   {
      name: "Fengus' Ferocity",
      iconname: "spell_nature_undyingstrength",
      description: "Attack power increased by 200.",
      group: "",
      aura: new Aura(9999, {  })
   },
   {
      name: "Songflower Serenade",
      iconname: "spell_holy_mindvision",
      description: "Increases chance for a melee, ranged, or spell critical by 5% and all attributes by 15 for 1 hr.",
      group: "",
      aura: new Aura(9999, {  })
   },
   {
      name: "",
      iconname: "",
      description: "",
      group: "",
      aura: new Aura(9999, {  })
   }

   
   
   

   
   
   

   
   
   

   
   
   




];


function buildBuffs() {
   let article = $('article.buffs');

   for(let buff of buffs) {
      let div = $('<div class="buff" data-group="' + buff.group + '"><img src="img/' + buff.iconname + '.jpg" alt="' + buff.name + '"><div class="tooltip"><p>' + buff.name + '</p><p class="description">' + buff.description + '</p></div></div>');
      div.click(function() {
         let b = $(this);
         b.toggleClass('active');
         if (b.hasClass('active')) {

            if (b.data('group'))
               b.siblings().filter('[data-group="' + b.data('group') + '"]').removeClass('active');

         }
      });
      article.append(div);
   }

}