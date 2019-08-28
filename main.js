var start, end;

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

    // console.log(player);
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
    $('table.gear tbody td:last-of-type').each(function () {
        let text = $(this).text();
        let diff = (text - dps).toFixed(2);
        let span = diff > 0 ? '<span class="p"> (+ ' + diff + ')</span>' : '<span class="n"> (' + diff + ')</span>';
        $(this).html(text + span);
    });
}

function updatePanel() {
    let player = buildPlayer();

    console.log(player);

    let space = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
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
    buildTalents();
    buildGear();
    buildWeapons();
    buildEnchants();
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

    $('input#rungear').click(function () {

        start = new Date().getTime();
        $('progress').show();
        $('progress').attr('value', 0);
        $('progress').attr('max', $('table.gear tbody tr:not(.hidden)').length);
        $('table.gear tbody td:last-of-type').text('');

        startSimulation($('#dps'));
        runRow($('table.gear tbody tr:not(.hidden)'), 0);

    });

    $('.race').click(function () {
        $(this).toggleClass('active');
        $(this).siblings().removeClass('active');
        $('.spell[data-id="' + $(this).data('spell') + '"]').toggleClass('hidden');
        $(this).siblings().each(function () {
            $('.spell[data-id="' + $(this).data('spell') + '"]').addClass('hidden').removeClass('active');
        });
        updatePanel();
    });

    $('.spell').click(function () {
        $(this).toggleClass('active');
        let disable = $(this).data('disable-buff');
        if (disable)
            $('.buff[data-group="' + disable + '"]').removeClass('active');
        updatePanel();
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

});
