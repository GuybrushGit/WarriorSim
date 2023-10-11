const { sets, gear, enchant } = require('../js/data/gear.js');
let duplicateList = {};

for (const slot in gear) {
  for (const i in gear[slot]) {
    var itemId = gear[slot][i].id;
    if (itemId) {
      if (!duplicateList[itemId]) {
        duplicateList[itemId]++;
      } else {
        console.log("Found a duplicate item ID: "+itemId);
      }
    }
  }
}

for (const slot in enchant) {
  for (const i in enchant[slot]) {
    var enchantId = enchant[slot][i].id;
    if (enchantId) {
      if (!duplicateList[enchantId]) {
        duplicateList[enchantId]++;
      } else {
        console.log("Found a duplicate enchant ID: "+enchantId);
      }
    }
  }
}

for (const i in sets) {
  var setId = sets[i].id;
  if (setId) {
    if (!duplicateList[setId]) {
      duplicateList[setId]++;
    } else {
      console.log("Found a duplicate set ID: "+setId);
    }
  }
}
