var start, end;



function startSimulation(output, gear, callback) {
    let player = new Player();

    // Talents
    $('.talent').each(function() {
        let count = parseInt($(this).attr('data-count'));
        let talent = getTalent($(this));
        $.extend(player.talents, talent.aura(count));
    });

    // Gear
    $('table.gear').each(function() {
        let slot = $(this).data('type');
        if (slot == 'enchant') return;
        let row = $(this).find('tbody tr.active');
        let aura = {};
        if (row.length) aura = getWeaponFromRow(row);
        if (gear && gear.slot == slot) aura = gear;
        for (let prop in player.base)
            player.base[prop] += aura[prop] || 0;

        if (aura.slot == 'mainhand') {
            player.mh = new Weapon(player, aura.speed, aura.minhit, aura.maxhit, aura.type, false);
            if (aura.ppm) {
                player.mh.proc1 = {};
                player.mh.proc1.chance = player.mh.speed * aura.ppm / 0.6;
                player.mh.proc1.dmg = aura.procdmg;
                if (aura.procspell)
                    player.mh.proc1.spell = eval('new ' + aura.procspell + '(player)');
            }
        }

        if (aura.slot == 'offhand') {
            player.oh = new Weapon(player, aura.speed, aura.minhit, aura.maxhit, aura.type, true);
            if (aura.ppm) {
                player.oh.proc1 = {};
                player.oh.proc1.chance = player.oh.speed * aura.ppm / 0.6;
                player.oh.proc1.dmg = aura.procdmg;
                if (aura.procspell)
                    player.oh.proc1.spell = eval('new ' + aura.procspell + '(player)');
            }
        }
    });

    $('table.gear[data-type="enchant"] tbody tr.active').each(function() {

        let row = $(this);
        let aura = getEnchantFromRow(row);
        if (gear && gear.slot == aura.slot) aura = gear;
        for (let prop in player.base) {
            if (prop == 'haste')
                player.base.haste /= (1 + aura.haste / 100) || 1;
            else
                player.base[prop] += aura[prop] || 0;
        }

        if (aura.slot.indexOf('Main Hand') >= 0) {
            player.mh.crit += aura.crit;
            player.mh.bonusdmg += aura.dmg;
            if (aura.ppm) {
                player.mh.proc2 = {};
                player.mh.proc2.chance = player.mh.speed * aura.ppm / 0.6;
                player.mh.proc2.dmg = aura.procdmg;
                if (aura.procspell)
                    player.mh.proc2.spell = eval('new ' + aura.procspell + '(player)');
            }
        }
        if (aura.slot.indexOf('Off Hand') >= 0) {
            player.oh.crit += aura.crit;
            player.oh.bonusdmg += aura.dmg;
            if (aura.ppm) {
                player.oh.proc2 = {};
                player.oh.proc2.chance = player.oh.speed * aura.ppm / 0.6;
                player.oh.proc2.dmg = aura.procdmg;
                if (aura.procspell)
                    player.oh.proc2.spell = eval('new ' + aura.procspell + '(player)');
            }
        }

    });

    // Buffs
    $('.buff.active').each(function() {
        let apbonus = 0;
        if ($(this).data('group') == "battleshout")
            apbonus = ~~($(this).data('ap') * player.talents.impbattleshout);
        if ($(this).data('spell'))
            player.spells[$(this).data('spell').toLowerCase()] = eval('new ' + $(this).data('spell') + '(player);');

        player.base.ap += ($(this).data('ap') || 0) + apbonus;
        player.base.agi += $(this).data('agi') || 0;
        player.base.str += $(this).data('str') || 0;
        player.base.crit += $(this).data('crit') || 0;
        player.base.agimod *= (1 + $(this).data('agimod') / 100) || 1;
        player.base.strmod *= (1 + $(this).data('strmod') / 100) || 1;
        player.base.dmgmod *= (1 + $(this).data('dmgmod') / 100) || 1;
        player.base.haste /= (1 + $(this).data('haste') / 100) || 1;
    });

    // Settings
    let settings = {};
    $('.settings input').each(function() {
        settings[$(this).attr('name')] = parseInt($(this).val());
    });
    $('.race.active').each(function() {
        let r = $(this);
        player.base.aprace = (r.data('ap') || 0);
        player.base.ap += (r.data('ap') || 0);
        player.base.str += (r.data('str') || 0);
        player.base.agi += (r.data('agi') || 0);
        player.base.skill_0 += (r.data('skill_0') || 0);
        player.base.skill_1 += (r.data('skill_1') || 0);
        player.base.skill_2 += (r.data('skill_2') || 0);
        player.base.skill_3 += (r.data('skill_2') || 0);
    });
    $('.spell.active').each(function() {
        let name = $(this).find('img').attr('alt');
        let lname = name.toLowerCase();
        if (lname == 'deepwounds') player.deepwounds = true;
        else player.spells[lname] = eval(`new ${name}(player)`);
        if (lname == 'recklessness') settings.recklessness = true;
    });
    player.target.armor = settings.armor;

    if (!player.mh || !player.oh)
        return addAlert('No weapons selected.');

    player.update();
    console.log(player);
    new Simulation(player, settings, gear ? settings.simulations : 10000, output, callback).start();
}

function addAlert(msg) {
    $('.alerts').empty().append('<div class="alert"><p>' + msg + '</p></div>');
    $('.alert').click(function() { closeAlert(); });
    setTimeout(function() { $('.alert').addClass('in-up') });
    setTimeout(function() { closeAlert(); }, 4000);
}

function closeAlert() {
    $('.alert').removeClass('in-up');
    setTimeout(function() { $('.alerts').empty(); }, 1000);
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
    $('progress').hide();
    $('table.gear').trigger('update');
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
    buildWeapons();
    buildEnchants();
    talentEvents();
    gearEvents();
    filterGear()

    $('body').on('click', '.wh-tooltip, .tablesorter-default a', function(e) {
        e.preventDefault();
    });

    $('input[type="submit"]').click(function () {

        start = new Date().getTime();
        $('progress').show();
        $('progress').attr('value', 0);
        $('progress').attr('max', $('table.gear tbody tr').length);
        $('table.gear tbody td:last-of-type').text('');

        startSimulation($('#dps'), null, complete);
        // runRow($('table.gear tbody tr'), 0);

    });

    $('.race').click(function() {
        $(this).toggleClass('active');
        $(this).siblings().removeClass('active');
        $('.spell[data-id="' + $(this).data('spell') + '"]').toggleClass('hidden');
        $(this).siblings().each(function() {
            $('.spell[data-id="' + $(this).data('spell') + '"]').addClass('hidden').removeClass('active');
        });
    });

    $('.spell').click(function() {
        $(this).toggleClass('active');
        let disable = $(this).data('disable-buff');
        if (disable)
            $('.buff[data-group="' + disable + '"]').removeClass('active');
    });

    $('nav li').click(function() {
        $(this).addClass('active');
        $(this).siblings().removeClass('active');
        let top = $('section').eq($(this).index()).offset().top;
        $('nav').addClass('scrolling');
        $("html, body").stop().animate({ scrollTop: top + 20 }, 300, 'swing', function() {
            $('nav').removeClass('scrolling');
        });
    });

    $(window).scroll(function() {
        if ($('nav').hasClass('scrolling')) return;
        let scroll = window.pageYOffset || document.documentElement.scrollTop;
        let counter = 0;
        $('section').each(function() {
            if ($(this).offset().top < scroll + 50)
                counter++;
        });
        let li = $('nav li').eq(counter - 1);
        li.addClass('active');
        li.siblings().removeClass('active');
    });

});
