// TODO
// armor
// hamstring
// talents
// weapons
// trinkets
// buffs

var input = {};
var spells = [];
var total = 0;
var log = true;
var start = 0;
var end = 0;

function simulation(i, player) {
    if (i > input.simulations) {
        end = new Date().getTime();
        console.log( (end - start) / 1000 );
        $('progress').attr('value', i-1);
        $('#dps').text( (total / (input.timesecs * (i-1))).toFixed(2) +' dps');
        return;
    }

    let totaldmg = 0;
    player.reset();
    let executeperc = input.timesecs * 10 * (100 - input.executeperc);
    for(let step = 0; step < input.timesecs * 1000; step += 10) {
        player.step();
        if (player.mh.timer == 0) totaldmg += player.attack(player.mh);
        if (player.oh.timer == 0) totaldmg += player.attack(player.oh);
        if (player.timer == 0) {
            if (player.execute && step >= executeperc && player.execute.canUse()) {
                totaldmg += player.cast(player.execute);
                continue;
            }
            if (player.overpower && player.overpower.canUse()) {
                totaldmg += player.cast(player.overpower);
                continue;
            }
            if (player.bloodthirst && player.bloodthirst.canUse()) {
                totaldmg += player.cast(player.bloodthirst );
                continue;
            }
            if (player.whirlwind && player.whirlwind.canUse()) {
                totaldmg += player.cast(player.whirlwind);
                continue;
            }
        }
    }

    total += totaldmg;
    
    if (i % 50 == 0) {
        $('progress').attr('value', i);
        $('#dps').text( (total / (input.timesecs * i)).toFixed(2) +' dps');
        setTimeout(function() { simulation(i+1, player); }, 0);
    }
    else {
        simulation(i+1, player);
    }
}

$(document).ready(function() {
    $('input[type="submit"]').click(function() {
        total = 0;
        start = new Date().getTime();
        let player = new Player();
        $('input[type="text"]').each(function() { 
            let prop = $(this).attr('name');
            input[prop] = parseInt($(this).val());
            player.base[prop] = input[prop];
        });
        $('input[type="checkbox"]').each(function() {
            if ($(this).is(':checked'))
                player[$(this).val().toLowerCase()] = eval("new " + $(this).val() + "(player)");
            else
                player[$(this).val().toLowerCase()] = null;
        });
        $('progress').attr('max', input.simulations);
        player.target.armor = input.armor;
        player.mh = new Weapon(player, 2.7, 66, 124, WEAPONTYPE.SWORD, false);
        player.oh = new Weapon(player, 1.8, 57, 87, WEAPONTYPE.SWORD, true);
        player.auras.push({ skill: 5 });
        player.auras.push({ hit: 6 });
        player.auras.push({ ap: 800 });
        player.auras.push({ str: 20 });
        player.auras.push({ crit: 5 });
        player.update();

        simulation(1, player);
    });
});
