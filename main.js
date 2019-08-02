// TODO
// hamstring
// talents
// weapons
// trinkets
// buffs
// check how speed mods stack

var log = true;
var start, end;

function getAuraFromRow(tr) {
    let data = tr.children();
    let aura = {};
    aura.str = parseInt(data.eq(4).text() || 0);
    aura.agi = parseInt(data.eq(5).text() || 0);
    aura.ap = parseInt(data.eq(6).text() || 0);
    aura.crit = parseInt(data.eq(7).text() || 0);
    aura.hit = parseInt(data.eq(8).text() || 0);
    aura.skill = parseInt(data.eq(9).text() || 0);
    aura.slot = tr.parents('table').data('type');
    return aura;
}

function startSimulation(output, gear, callback) {
    let input = {};
    let player = new Player();
    $('table').each(function() {
        let slot = $(this).data('type');
        let row = $(this).find('tbody tr.active');
        let aura = {};
        if (row.length) aura = getAuraFromRow(row);
        if (gear && gear.slot == slot) aura = gear;
        for (let prop in aura)
            player.gear[prop] += aura[prop];
    });
    $('input[type="text"]').each(function () {
        let prop = $(this).attr('name');
        input[prop] = parseInt($(this).val());
    });
    $('#spells input[type="checkbox"]').each(function () {
        if ($(this).is(':checked'))
            player.spells[$(this).val().toLowerCase()] = eval("new " + $(this).val() + "(player)");
    });
    $('#buffs input[type="checkbox"]').each(function () {
        player[$(this).val().toLowerCase()] = $(this).is(':checked');
    });

    player.talents.crit = 20;


    player.base.ap = input.ap;
    player.base.str = input.str;
    player.base.agi = input.agi;
    player.target.armor = input.armor;
    player.mh = new Weapon(player, 2.7, 66, 124, WEAPONTYPE.SWORD, false);
    player.oh = new Weapon(player, 1.8, 57, 87, WEAPONTYPE.SWORD, true);
    player.update();

    new Simulation(player, input.timesecs, input.simulations, input.executeperc, output, callback).start();
}

function runRow(rows, index) {
    let row = rows.eq(index);
    if (!row.length) return setTimeout(complete, 10);
    startSimulation(row.children().last(), getAuraFromRow(row), function () {
        runRow(rows, index + 1);
        $('progress').attr('value', index + 1);
    });
}

function complete() {
    $('table').trigger('update');
    end = new Date().getTime();
    console.log( (end - start) / 1000 );
    let dps = parseFloat($('#dps').text()).toFixed(2);
    $('tbody td:last-of-type').each(function() {
        let text = $(this).text();
        let diff = (text - dps).toFixed(2);
        let span = diff > 0 ? '<span class="p"> (+ ' + diff + ')</span>' : '<span class="n"> (' + diff + ')</span>';
        $(this).html(text + span);
    });
}

$(document).ready(function () {

    // talents.push({ crit: 5 }); // Cruelty
    // talents.push({ extrarage: 40 }); // Unbridled Wrath
    // talents.push({ battleshoutduration: 50 }); // Booming Voice
    // talents.push({ battleshoutpower: 25 }); // Imp Battle Shout
    // talents.push({ executecost: 5 }); // Execute Cost
    // talents.push({ offhanddamage: 25 }); // Dual Wield Specialization


    $('input[type="submit"]').click(function () {

        start = new Date().getTime();
        $('progress').attr('max', $('tbody tr').length);
        $('tbody td:last-of-type').text('');

        startSimulation($('#dps'));
        //runRow($('tbody tr'), 0);

    });

    $("table").tablesorter({
        theme: 'blue',
        widthFixed: true,
        sortList: [[11, 1]]
    });

    $('tbody td').click(function () {
        let tr = $(this).parent();
        tr.toggleClass('active');
        tr.siblings().removeClass('active');
    });
});
