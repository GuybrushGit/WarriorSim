var start, end, counter = 0;

function startSimulation(output, row, callback) {
    let testgear;
    if (row) testgear = getAuraFromRow(row);
    let player = buildPlayer(testgear);

    if (!player.mh || !player.oh)
        return addAlert('No weapons selected.');

    let settings = {};
    $('.settings input').each(function () {
        settings[$(this).attr('name')] = parseInt($(this).val());
    });
    settings.recklessness = $('.spell[data-id="recklessness"]').hasClass('active');

    new Simulation(player, settings, output, callback).start();
}

function addAlert(msg) {
    $('.alerts').empty().append('<div class="alert"><p>' + msg + '</p></div>');
    $('.alert').click(function () { closeAlert(); });
    setTimeout(function () { $('.alert').addClass('in-up') });
    setTimeout(function () { closeAlert(); }, 4000);
}

function closeAlert() {
    $('.alert').removeClass('in-up');
    setTimeout(function () { $('.alerts').empty(); }, 1000);
}

function runRow(rows, index) {
    let row = rows.eq(index);
    if (!row.length) return setTimeout(complete, 10);
    startSimulation(row.children().last(), row, function () {
        runRow(rows, index + 1);
        $('progress').attr('value', index + 1);
    });
}

function complete() {
    $('progress').hide();
    $('table.gear').trigger('update');
    end = new Date().getTime();
    $('#time').html((end - start) / 1000 + ' s');
    let dps = parseFloat($('#dps').text()).toFixed(2);
    $('table.gear tbody tr:not(.hidden) td:last-of-type').each(function () {
        let text = $(this).text();
        let diff = (text - dps).toFixed(2);
        let span = diff > 0 ? '<span class="p"> (+ ' + diff + ')</span>' : '<span class="n"> (' + diff + ')</span>';
        $(this).html(text + span);
    });
}

function updatePanel() {
    let player = buildPlayer();
    let space = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
    if (!player.mh || !player.oh) return;
    $('.char #str').text(player.stats.str);
    $('.char #agi').text(player.stats.agi);
    $('.char #ap').text(player.stats.ap);
    $('.char #skill').html(player.stats['skill_' + player.mh.type] + ' <small>MH</small>' + space + player.stats['skill_' + player.oh.type] + ' <small>OH</small>');
    $('.char #miss').html(Math.max(player.mh.miss, 0).toFixed(2) + '% <small>MH</small>' + space + (player.mh.miss + 19).toFixed(2) + '% <small>DW</small>');
    let mhcrit = player.crit + player.mh.crit;
    let ohcrit = player.crit + player.oh.crit;
    $('.char #crit').html(mhcrit.toFixed(2) + '% <small>MH</small>' + space + ohcrit.toFixed(2) + '% <small>OH</small>');
    let mhcap = 100 - player.mh.miss - 19 - player.mh.dodge - player.mh.glanceChance;
    let ohcap = 100 - player.oh.miss - 19 - player.oh.dodge - player.oh.glanceChance;
    $('.char #critcap').html(mhcap.toFixed(2) + '% <small>MH</small>'+ space + ohcap.toFixed(2) + '% <small>OH</small>');
    let mhdmg = player.stats.dmgmod * player.mh.modifier * 100;
    let ohdmg = player.stats.dmgmod * player.oh.modifier * 100;
    $('.char #dmgmod').html(mhdmg.toFixed(2) + '% <small>MH</small>' + space + ohdmg.toFixed(2) + '% <small>OH</small>');
    $('.char #haste').html((player.stats.haste * 100).toFixed(2) + '%');
}

$(document).ready(function () {

    buildBuffs();
    buildGear();
    buildWeapons();
    //buildEnchants();
    loadSession();
    buildTalents();
    talentEvents();
    gearEvents();
    filterGear();
    updatePanel();

    $('body').on('click', '.wh-tooltip, .tablesorter-default a', function (e) {
        e.preventDefault();
    });

    $('input#runsim').click(function () {
        start = new Date().getTime();
        startSimulation($('#dps'), null, function() {
            end = new Date().getTime();
            $('#time').html((end - start) / 1000 + ' s');
        });
    });

    $('input#runselected').click(function () {

        start = new Date().getTime();
        $('progress').show();
        $('progress').attr('value', 0);

        let trs = [];
        $('progress').attr('max', $('table.gear tbody tr:not(.hidden)').length);
        $('table.gear tbody td:last-of-type').text('');

        startSimulation($('#dps'), null, function() {
            runRow($('table.gear tbody tr:not(.hidden)'), 0);
        });
    });

    $('input#rungear').click(function () {

        start = new Date().getTime();
        $('progress').show();
        $('progress').attr('value', 0);
        $('progress').attr('max', $('table.gear tbody tr:not(.hidden)').length);
        $('table.gear tbody td:last-of-type').text('');

        startSimulation($('#dps'), null, function() {
            runRow($('table.gear tbody tr:not(.hidden)'), 0);
        });
    });

    $('.race').click(function () {
        $(this).toggleClass('active');
        $(this).siblings().removeClass('active');
        $('.spell[data-id="' + $(this).data('spell') + '"]').toggleClass('hidden');
        $(this).siblings().each(function () {
            $('.spell[data-id="' + $(this).data('spell') + '"]').addClass('hidden').removeClass('active');
        });
        updatePanel();
        updateSession();
    });

    $('.spell').click(function () {
        $(this).toggleClass('active');
        let disable = $(this).data('disable-buff');
        if (disable)
            $('.buff[data-group="' + disable + '"]').removeClass('active');
        updatePanel();
        updateSession();
    });

    $('nav li').click(function () {
        $(this).addClass('active');
        $(this).siblings().removeClass('active');
        let top = $('section').eq($(this).index()).offset().top;
        $('nav').addClass('scrolling');
        $("html, body").stop().animate({ scrollTop: top + 20 }, 300, 'swing', function () {
            $('nav').removeClass('scrolling');
        });
    });

    $(window).scroll(function () {
        if ($('nav').hasClass('scrolling')) return;
        let scroll = window.pageYOffset || document.documentElement.scrollTop;
        let counter = 0;
        $('section').each(function () {
            if ($(this).offset().top < scroll + 50)
                counter++;
        });
        let li = $('nav li').eq(counter - 1);
        li.addClass('active');
        li.siblings().removeClass('active');
    });

    $('input[type="text"]').keyup(function() {
        localStorage[$(this).attr('name')] = $(this).val();
    });

});

function updateSession() {
    let spells = [];
    let buffs = [];
    let sources = [];
    let phases = [];
    let _talents = [];
    let items = [];
    let enchants = [];
    localStorage.race = $('.race.active').index();
    $('.spell.active').each(function() {
        spells.push($(this).index());
    });
    $('.buff.active').each(function() {
        buffs.push($(this).index());
    });
    $('.sources .active').each(function() {
        sources.push($(this).index());
    });
    $('.phases .active').each(function() {
        phases.push($(this).index());
    });
    $('table.gear:not([data-type="enchant"]) tr.active').each(function() {
        items.push({ id: $(this).data('id'), slot: $(this).parents('table').data('type') });
    });
    $('table.gear[data-type="enchant"] tr.active').each(function() {
        enchants.push({ id: $(this).data('id'), slot: $(this).data('slot') });
    });
    for(let tree of talents) {
        let arr = [];
        for(let talent of tree.t)
            arr.push(talent.c);
        _talents.push({ n: tree.n, t: arr });
    }
    localStorage.spells = JSON.stringify(spells);
    localStorage.buffs = JSON.stringify(buffs);
    localStorage.sources = JSON.stringify(sources);
    localStorage.spells = JSON.stringify(spells);
    localStorage.phases = JSON.stringify(phases);
    localStorage.talents = JSON.stringify(_talents);
    localStorage.items = JSON.stringify(items);
    localStorage.enchants = JSON.stringify(enchants);
}

function loadSession() {
    let spells = !localStorage.spells ? [] : JSON.parse(localStorage.spells);
    let buffs = !localStorage.buffs ? [] : JSON.parse(localStorage.buffs);
    let sources = !localStorage.sources ? [0,1,2,3,4,10,11,12] : JSON.parse(localStorage.sources);
    let phases = !localStorage.phases ? [0] : JSON.parse(localStorage.phases);
    let _talents = !localStorage.talents ? [] : JSON.parse(localStorage.talents);
    let items = !localStorage.items ? [] : JSON.parse(localStorage.items);
    let enchants = !localStorage.enchants ? [] : JSON.parse(localStorage.enchants);
    let race = !localStorage.race ? 0 : localStorage.race;
    let racediv = $('.race').eq(race);
    
    for(let prop in localStorage) {
        $('input[name="' + prop + '"]').val(localStorage[prop]);
    }
    
    racediv.addClass('active');
    $('.spell[data-id="' + racediv.data('spell') + '"]').removeClass('hidden');

    for(let i of spells) $('.spell').eq(i).addClass('active');
    for(let i of buffs) $('.buff').eq(i - 1).addClass('active');
    for(let i of sources) $('.sources li').eq(i).addClass('active');
    for(let i of phases) $('.phases li').eq(i).addClass('active');

    for(let tree in _talents)
        for(let talent in _talents[tree].t){
            talents[tree].t[talent].c = _talents[tree].t[talent];
        }

    for(let i of items) $('table[data-type="' + i.slot + '"] tr[data-id="' + i.id + '"]').addClass('active');
    for(let i of enchants) $('tr[data-id="' + i.id + '"][data-slot="' + i.slot + '"]').addClass('active');
            
}