// TODO
// hamstring
// talents
// weapons
// trinkets
// buffs
// check how speed mods stack

var log = false;
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

    // Gear
    $('table.gear').each(function() {
        let slot = $(this).data('type');
        let row = $(this).find('tbody tr.active');
        let aura = {};
        if (row.length) aura = getAuraFromRow(row);
        if (gear && gear.slot == slot) aura = gear;
        for (let prop in aura)
            if (prop != "slot")
                player.base[prop] += aura[prop];
    });

    // Buffs
    $('.buff.active').each(function() {
        player.base.ap += $(this).data('ap') || 0;
        player.base.agi += $(this).data('agi') || 0;
        player.base.str += $(this).data('str') || 0;
        player.base.crit += $(this).data('crit') || 0;
        player.base.agimod *= (1 + $(this).data('agimod') / 100) || 1;
        player.base.strmod *= (1 + $(this).data('strmod') / 100) || 1;
        player.base.dmgmod *= (1 + $(this).data('dmgmod') / 100) || 1;
        player.base.haste /= (1 + $(this).data('haste') / 100) || 1;
    });

    // Talents
    $('.talent').each(function() {
        let count = parseInt($(this).attr('data-count'));
        let tree = $(this).parents('table').index();
        let x = $(this).data('x');
        let y = $(this).data('y');
        if (count == 0) return;
        for(let talent of talents[tree - 1].t)
            if (talent.x == x && talent.y == y)
                $.extend(player.talents, talent.aura(count));
    });

    // Settings
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
    player.base.ap = input.ap;
    player.base.str = input.str;
    player.base.agi = input.agi;
    player.target.armor = input.armor;



    player.mh = new Weapon(player, 2.7, 66, 124, WEAPONTYPE.SWORD, false);
    player.oh = new Weapon(player, 1.8, 57, 87, WEAPONTYPE.SWORD, true);


    player.update();

    console.log(player);

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
    $('table.gear tbody td:last-of-type').each(function() {
        let text = $(this).text();
        let diff = (text - dps).toFixed(2);
        let span = diff > 0 ? '<span class="p"> (+ ' + diff + ')</span>' : '<span class="n"> (' + diff + ')</span>';
        $(this).html(text + span);
    });
}



$(document).ready(function () {

    buildBuffs();
    buildTalents();
    talentEvents();

    $('input[type="submit"]').click(function () {

        start = new Date().getTime();
        $('progress').attr('max', $('tbody tr').length);
        $('table.gear tbody td:last-of-type').text('');

        startSimulation($('#dps'));
        //runRow($('tbody tr'), 0);

    });

    $("table.gear").tablesorter({
        theme: 'dark',
        widthFixed: true,
        sortList: [[11, 1]]
    });

    $('table.gear tbody td').click(function () {
        let tr = $(this).parent();
        tr.toggleClass('active');
        tr.siblings().removeClass('active');
    });
});
