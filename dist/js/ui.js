var SIM = SIM || {}

SIM.UI = {

    init: function () {
        var view = this;
        view.variables();
        view.events();
        view.loadSession();
        view.loadWeapons("mainhand");
        view.updateSidebar();

        view.body.on('click', '.wh-tooltip, .tablesorter-default a', function (e) {
            e.preventDefault();
        });

    },

    variables: function () {
        var view = this;
        view.body = $('body');
        view.buffs = view.body.find('article.buffs');
        view.fight = view.body.find('article.fight');
        view.rotation = view.body.find('article.rotation');
        view.talents = view.body.find('article.talents');
        view.filter = view.body.find('article.filter');
        view.main = view.body.find('section.main');
        view.sidebar = view.body.find('section.sidebar');
        view.tcontainer = view.main.find('.table-container');
        view.alerts = view.body.find('.alerts');
        view.progress = view.main.find('progress');
    },

    events: function () {
        var view = this;

        view.sidebar.find('.js-settings').click(function (e) {
            e.preventDefault();
            $(this).toggleClass('active');
            $('section.settings').toggleClass('active');
            view.sidebar.find('.js-stats').removeClass('active');
            $('section.stats').removeClass('active');
        });

        view.sidebar.find('.js-dps').click(function (e) {
            e.preventDefault();
            view.startLoading();
            view.simulateDPS();
        });

        view.sidebar.find('.js-stats').click(function (e) {
            e.preventDefault();
            $(this).toggleClass('active');
            $('section.stats').toggleClass('active');
            view.sidebar.find('.js-settings').removeClass('active');
            $('section.settings').removeClass('active');
        });

        view.main.on('click', '.js-table', function(e) {
            e.preventDefault();
            let first = view.tcontainer.find('table.gear tbody tr').first();
            view.tcontainer.find('table.gear tbody tr').addClass('waiting');
            view.tcontainer.find('table.gear tbody tr td:last-of-type').html('');
            view.startLoading();
            view.simulateDPS(first);
        });

        view.main.on('click', '.js-enchant', function(e) {
            e.preventDefault();
            let first = view.tcontainer.find('table.enchant tbody tr').first();
            view.tcontainer.find('table.enchant tbody tr').addClass('waiting');
            view.tcontainer.find('table.enchant tbody tr td:last-of-type').html('');
            view.startLoading();
            view.simulateDPS(first);
        });

        view.main.find('nav li').click(function () {
            $(this).addClass('active');
            $(this).siblings().removeClass('active');
            var type = $(this).data('type');

            if (type == "mainhand" || type == "offhand" || type == "twohand") 
                view.loadWeapons(type);
            else 
                view.loadGear(type);
        });

        view.tcontainer.on('click', 'table.gear td:not(.ppm)', function(e) {
            var table = $(this).parents('table');
            var type = table.data('type');
            var max = table.data('max');
            var tr = $(this).parent();

            if (tr.hasClass('active')) {
                view.rowDisableItem(tr);
            }
            else {
                var counter = table.find('tr.active').length;
                if (counter >= max) view.rowDisableItem(table.find('tr.active').last());
                view.rowEnableItem(tr);
            }

            view.updateSession();
            view.updateSidebar();
        });

        view.tcontainer.on('click', 'table.enchant td:not(.ppm)', function(e) {
            var table = $(this).parents('table');
            var tr = $(this).parent();
            var temp = tr.data('temp')

            if (tr.hasClass('active')) {
                view.rowDisableEnchant(tr);
            }
            else {
                let disable = table.find('tr.active[data-temp="' + temp + '"]').first();
                if (disable.length) view.rowDisableEnchant(disable);
                view.rowEnableEnchant(tr);
            }

            view.updateSession();
            view.updateSidebar();
        });

        view.main.on('change', 'nav select', function(e) {
            var type = $(this).parent().data('type');
            view.loadWeapons(type);
            view.updateSession();
        });
    },

    simulateDPS: function(row) {
        let view = this;
        let dps = view.sidebar.find('#dps');
        let stats = view.sidebar.find('#stats');
        let time = view.sidebar.find('#time');
        let btn = view.sidebar.find('.js-dps');
        dps.text('');
        time.text('');
        var player = new Player();
        if (row) {
            let type = row.parents('table').data('type');
            if (type == "finger" || type == "trinket")
                player = new Player(null, type);
        }
        if (!player.mh) {
            view.addAlert('No weapon selected');
            view.endLoading();
            return;
        }
        var sim = new Simulation(player, 
            () => {
                // Finished
                dps.text((sim.totaldmg / (sim.duration * sim.iterations)).toFixed(2));
                time.text((sim.endtime - sim.starttime) / 1000);
                stats.html((sim.mindmg / sim.duration).toFixed(2) + ' min&nbsp;&nbsp;&nbsp;&nbsp;' + (sim.maxdmg / sim.duration).toFixed(2) + ' max');
                btn.css('background', '');
                if (row) view.simulateRow(row);
                else view.endLoading();

                SIM.STATS.initCharts(sim);
                sim = null;
                player = null;
            },
            (iteration) => {
                // Update
                let perc = parseInt(iteration / sim.iterations * 100);
                dps.text((sim.totaldmg / (sim.duration * iteration)).toFixed(2));
                btn.css('background', 'linear-gradient(to right, transparent ' + perc + '%, #444 ' + perc + '%)');
            }
        );
        sim.start();
    },

    simulateRow: function(tr) {
        var view = this;
        var dps = tr.find('td:last-of-type');
        var type = tr.parents('table').data('type');
        var item = tr.data('id');
        var isench = tr.parents('table').hasClass('enchant');
        var istemp = tr.data('temp') == true;
        var base = parseFloat(view.sidebar.find('#dps').text());
        var rows = tr.siblings().length + 1;
        var rowsdone = tr.siblings(':not(.waiting)').length;

        var player = new Player(item, type, istemp ? 2 : isench ? 1 : 0);
        var sim = new Simulation(player, 
            () => {
                // Finished
                let span = $('<span></span>');
                let calc = sim.totaldmg / (sim.duration * sim.iterations);
                let diff = calc - base;
                span.text(diff.toFixed(2));
                if (diff >= 0) span.addClass('p');
                else span.addClass('n');
                dps.text(calc.toFixed(2)).append(span);
                view.tcontainer.find('table').trigger('update');
                tr.removeClass('waiting');
                let perc = parseInt(((rowsdone + 1) * sim.iterations) / (sim.iterations * rows) * 100);
                view.progress.attr('value',perc);
                sim = null;
                player = null;

                if (isench) {
                    for(let i of enchant[type])
                        if (i.id == item)
                            i.dps = calc.toFixed(2);
                }
                else {
                    for(let i of gear[type])
                        if (i.id == item)
                            i.dps = calc.toFixed(2);
                }

                let next = view.tcontainer.find('tbody tr.waiting').first();
                if (next.length) view.simulateRow(next);
                else { view.endLoading(); view.updateSession(); }
            },
            (iteration) => {
                // Update
                let perc = parseInt((rowsdone * sim.iterations + iteration) / (sim.iterations * rows) * 100);
                view.progress.attr('value',perc);
                dps.text((sim.totaldmg / (sim.duration * iteration)).toFixed(2));
            }
        );
        sim.start();
    },

    rowDisableItem: function(tr) {
        var table = tr.parents('table');
        var type = table.data('type');
        tr.removeClass('active');
        for(let i = 0; i < gear[type].length; i++) {
            if (gear[type][i].id == tr.data('id'))
                gear[type][i].selected = false;
        }
    },

    rowEnableItem: function(tr) {
        var table = tr.parents('table');
        var type = table.data('type');
        tr.addClass('active');
        for(let i = 0; i < gear[type].length; i++) {
            if (gear[type][i].id == tr.data('id'))
                gear[type][i].selected = true;
        }

        if (type == "twohand") {
            for(let i = 0; i < gear.mainhand.length; i++)
                gear.mainhand[i].selected = false;
            for(let i = 0; i < gear.offhand.length; i++)
                gear.offhand[i].selected = false;
            for(let i = 0; i < enchant.mainhand.length; i++)
                enchant.mainhand[i].selected = false;
            for(let i = 0; i < enchant.offhand.length; i++)
                enchant.offhand[i].selected = false;
        }

        if (type == "mainhand" || type == "offhand") {
            for(let i = 0; i < gear.twohand.length; i++)
                gear.twohand[i].selected = false;
            for(let i = 0; i < enchant.twohand.length; i++)
                enchant.twohand[i].selected = false;
        }
    },

    rowDisableEnchant: function(tr) {
        var table = tr.parents('table');
        var type = table.data('type');
        tr.removeClass('active');
        for(let i = 0; i < enchant[type].length; i++) {
            if (enchant[type][i].id == tr.data('id'))
                enchant[type][i].selected = false;
        }
    },

    rowEnableEnchant: function(tr) {
        var table = tr.parents('table');
        var type = table.data('type');
        tr.addClass('active');
        for(let i = 0; i < enchant[type].length; i++) {
            if (enchant[type][i].id == tr.data('id'))
                enchant[type][i].selected = true;
        }
    },

    startLoading: function() {
        let btns = $('.js-dps, .js-table, .js-enchant');
        btns.addClass('loading');
        btns.append('<span class="spinner"><span class="bounce1"></span><span class="bounce2"></span><span class="bounce3"></span></span>');
        $('section.main nav').addClass('loading');
    },

    endLoading: function() {
        let btns = $('.js-dps, .js-table, .js-enchant');
        btns.removeClass('loading');
        btns.find('.spinner').remove();
        $('section.main nav').removeClass('loading');
    },

    updateSidebar: function () {
        var view = this;
        var player = new Player();

        let space = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        if (!player.mh) return;
        view.sidebar.find('#str').text(player.stats.str);
        view.sidebar.find('#agi').text(player.stats.agi);
        view.sidebar.find('#ap').text(player.stats.ap);
        view.sidebar.find('#skill').html(player.stats['skill_' + player.mh.type] + ' <small>MH</small>' + (player.oh ? space + player.stats['skill_' + player.oh.type] + ' <small>OH</small>' : ''));
        view.sidebar.find('#miss').html(Math.max(player.mh.miss, 0).toFixed(2) + '% <small>1H</small>' + (player.oh ? space + Math.max(player.mh.dwmiss, 0).toFixed(2) + '% <small>DW</small>' : ''));
        let mhcrit = player.crit + player.mh.crit;
        let ohcrit = player.crit + (player.oh ? player.oh.crit : 0);
        view.sidebar.find('#crit').html(mhcrit.toFixed(2) + '% <small>MH</small>' + (player.oh ? space + ohcrit.toFixed(2) + '% <small>OH</small>' : ''));
        let mhcap = 100 - player.mh.miss - 19 - player.mh.dodge - player.mh.glanceChance;
        let ohcap = player.oh ? 100 - player.oh.miss - 19 - player.oh.dodge - player.oh.glanceChance : 0;
        view.sidebar.find('#critcap').html(mhcap.toFixed(2) + '% <small>MH</small>'+ (player.oh ? space + ohcap.toFixed(2) + '% <small>OH</small>' : ''));
        let mhdmg = player.stats.dmgmod * player.mh.modifier * 100;
        let ohdmg = player.stats.dmgmod * (player.oh ? player.oh.modifier * 100 : 0);
        view.sidebar.find('#dmgmod').html(mhdmg.toFixed(2) + '% <small>MH</small>' + (player.oh ? space + ohdmg.toFixed(2) + '% <small>OH</small>' : ''));
        view.sidebar.find('#haste').html((player.stats.haste * 100).toFixed(2) + '%');
        view.sidebar.find('#race').text(localStorage.race);
    },

    updateSession: function () {
        var view = this;

        localStorage.level = view.fight.find('input[name="level"]').val();
        localStorage.race = view.fight.find('select[name="race"]').val();
        localStorage.simulations = view.fight.find('input[name="simulations"]').val();
        localStorage.timesecs = view.fight.find('input[name="timesecs"]').val();
        localStorage.startrage = view.fight.find('input[name="startrage"]').val();
        localStorage.targetlevel = view.fight.find('input[name="targetlevel"]').val();
        localStorage.targetarmor = view.fight.find('input[name="targetarmor"]').val();
        localStorage.targetresistance = view.fight.find('input[name="targetresistance"]').val();
        localStorage.adjacent = view.fight.find('input[name="adjacent"]').val();
        localStorage.adjacentlevel = view.fight.find('input[name="adjacentlevel"]').val();
        localStorage.mainhandfilter = view.main.find('#mainhandfilter').val();
        localStorage.offhandfilter = view.main.find('#offhandfilter').val();
        localStorage.twohandfilter = view.main.find('#twohandfilter').val();

        let _buffs = [], _rotation = [], _talents = [], _sources = [], _phases = [], _gear = {}, _enchant = {};
        view.buffs.find('.active').each(function () { _buffs.push($(this).attr('data-id')); });
        view.filter.find('.sources .active').each(function () { _sources.push($(this).attr('data-id')); });
        view.filter.find('.phases .active').each(function () { _phases.push($(this).attr('data-id')); });

        for (let tree of talents) {
            let arr = [];
            for (let talent of tree.t)
                arr.push(talent.c);
            _talents.push({ n: tree.n, t: arr });
        }

        view.rotation.find('.spell').each(function () {
            var sp = {};
            sp.id = $(this).attr('data-id');
            sp.active = $(this).hasClass('active');
            $(this).find('input').each(function () {
                sp[$(this).attr('name')] = $(this).val();
            });
            _rotation.push(sp);
        });

        for (let type in gear) {
            _gear[type] = [];
            for (let item of gear[type]) {
                _gear[type].push({id:item.id,selected:item.selected,dps:item.dps});
            }
        }

        for (let type in enchant) {
            _enchant[type] = [];
            for (let item of enchant[type]) {
                _enchant[type].push({id:item.id,selected:item.selected,dps:item.dps});
            }
        }

        localStorage.buffs = JSON.stringify(_buffs);
        localStorage.rotation = JSON.stringify(_rotation);
        localStorage.sources = JSON.stringify(_sources);
        localStorage.phases = JSON.stringify(_phases);
        localStorage.talents = JSON.stringify(_talents);
        localStorage.gear = JSON.stringify(_gear);
        localStorage.enchant = JSON.stringify(_enchant);
    },

    loadSession: function () {
        var view = this;

        for (let prop in localStorage) {
            view.fight.find('input[name="' + prop + '"]').val(localStorage[prop]);
            view.fight.find('select[name="' + prop + '"]').val(localStorage[prop]);
        }

        view.sidebar.find('.bg').attr('data-race', view.fight.find('select[name="race"]').val());
        view.main.find('#mainhandfilter').val(localStorage.mainhandfilter);
        view.main.find('#offhandfilter').val(localStorage.offhandfilter);
        view.main.find('#twohandfilter').val(localStorage.twohandfilter);

        let _buffs = !localStorage.buffs ? JSON.parse(session.buffs) : JSON.parse(localStorage.buffs);
        let _rotation = !localStorage.rotation ? JSON.parse(session.rotation) : JSON.parse(localStorage.rotation);
        let _sources = !localStorage.sources ? JSON.parse(session.sources) : JSON.parse(localStorage.sources);
        let _phases = !localStorage.phases ? JSON.parse(session.phases) : JSON.parse(localStorage.phases);
        let _talents = !localStorage.talents ? JSON.parse(session.talents) : JSON.parse(localStorage.talents);
        let _gear = !localStorage.gear ? JSON.parse(session.gear) : JSON.parse(localStorage.gear);
        let _enchant = !localStorage.enchant ? JSON.parse(session.enchant) : JSON.parse(localStorage.enchant);

        for (let tree in _talents)
            for (let talent in _talents[tree].t)
                talents[tree].t[talent].c = _talents[tree].t[talent];

        for (let i of _buffs)
            for (let j of buffs)
                if (i == j.id) j.active = true;

        for (let i of _rotation)
            for (let j of spells)
                if (i.id == j.id)
                    for (let prop in i)
                        j[prop] = i[prop];

        for (let i of _sources)
            view.filter.find(`.sources [data-id="${i}"]`).addClass('active');

        for (let i of _phases)
            view.filter.find(`.phases [data-id="${i}"]`).addClass('active');

        for (let type in _gear)
            for (let i of _gear[type])
                for (let j of gear[type])
                    if (i.id == j.id) {
                        j.dps = i.dps;
                        j.selected = i.selected;
                    }

        for (let type in _enchant)
            for (let i of _enchant[type])
                for (let j of enchant[type])
                    if (i.id == j.id) {
                        j.dps = i.dps;
                        j.selected = i.selected;
                    }

    },

    filterGear: function () {
        var view = this;
        var type = view.main.find('nav li.active').data('type');
        if (type == "mainhand" || type == "offhand") 
            view.loadWeapons(type);
        else 
            view.loadGear(type);
    },

    loadWeapons: function (type) {
        var view = this;
        var filter;

        if (type == "mainhand") filter = view.main.find('#mainhandfilter').val();
        if (type == "offhand") filter = view.main.find('#offhandfilter').val();
        if (type == "twohand") filter = view.main.find('#twohandfilter').val();

        let table = `<table class="gear" data-type="${type}" data-max="1">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Source</th>
                                <th>Sta</th>
                                <th>Str</th>
                                <th>Agi</th>
                                <th>AP</th>
                                <th>Crit</th>
                                <th>Hit</th>
                                <th>Min</th>
                                <th>Max</th>
                                <th>Speed</th>
                                <th>Skill</th>
                                <th>Type</th>
                                <th>PPM</th>
                                <th>DPS</th>
                            </tr>
                        </thead>
                    <tbody>`;

        for (let item of gear[type]) {

            if (filter && item.type != filter)
                continue;

            let source = item.source.toLowerCase(), phase = item.phase;
            if (item.source == 'Lethon' || item.source == 'Emeriss' || item.source == 'Kazzak' || item.source == 'Azuregos' || item.source == 'Ysondre' || item.source == 'Taerar')
                source = 'worldboss';

            if (phase && !view.filter.find('.phases [data-id="' + phase + '"]').hasClass('active'))
                continue;
            if (source && !view.filter.find('.sources [data-id="' + source + '"]').hasClass('active'))
                continue;
                
            table += `<tr data-id="${item.id}" data-name="${item.name}" class="${item.selected ? 'active' : ''}">
                        <td><a href="https://classic.wowhead.com/item=${item.id}"></a>${item.name}</td>
                        <td>${item.source}</td>
                        <td>${item.sta || ''}</td>
                        <td>${item.str || ''}</td>
                        <td>${item.agi || ''}</td>
                        <td>${item.ap || ''}</td>
                        <td>${item.crit || ''}</td>
                        <td>${item.hit || ''}</td>
                        <td>${item.minhit || ''}</td>
                        <td>${item.maxhit || ''}</td>
                        <td>${item.speed || ''}</td>
                        <td>${item.skill || ''}</td>
                        <td>${item.type || ''}</td>
                        <td class="ppm"><p contenteditable="true">${item.ppm || ''}</p></td>
                        <td>${item.dps || ''}</td>
                    </tr>`;
        }

        table += '</tbody></table></section>';

        view.tcontainer.empty();
        view.tcontainer.append(table);
        view.tcontainer.find('table.gear').tablesorter({
            widthFixed: true,
            sortList: [[14, 1],[0, 0]],
        });

        // disable hidden items
        for (let item of gear[type]) {
            if (item.selected && !view.tcontainer.find('tr[data-id="' + item.id + '"]').length)
                item.selected = false;
        }

        view.loadEnchants(type);
    },

    loadGear: function (type) {
        var view = this;

        var max = 1;
        if (type == 'trinket' || type == 'finger') max = 2;
        let table = `<table class="gear" data-type="${type}" data-max="${max}">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Source</th>
                                <th>Sta</th>
                                <th>Str</th>
                                <th>Agi</th>
                                <th>AP</th>
                                <th>Hit</th>
                                <th>Crit</th>
                                <th>Skill</th>
                                <th>Type</th>
                                <th>DPS</th>
                            </tr>
                        </thead>
                    <tbody>`;

        for (let item of gear[type]) {

            let source = item.source.toLowerCase(), phase = item.phase;
            if (item.source == 'Lethon' || item.source == 'Emeriss' || item.source == 'Kazzak' || item.source == 'Azuregos' || item.source == 'Ysondre' || item.source == 'Taerar')
                source = 'worldboss';

            if (phase && !view.filter.find('.phases [data-id="' + phase + '"]').hasClass('active'))
                continue;
            if (source && !view.filter.find('.sources [data-id="' + source + '"]').hasClass('active'))
                continue;

            let tooltip = item.id;
            if (tooltip == 145541) tooltip = 14554;

            table += `<tr data-id="${item.id}" class="${item.selected ? 'active' : ''}">
                        <td><a href="https://classic.wowhead.com/item=${tooltip}"></a>${item.name}</td>
                        <td>${item.source || ''}</td>
                        <td>${item.sta || ''}</td>
                        <td>${item.str || ''}</td>
                        <td>${item.agi || ''}</td>
                        <td>${item.ap || ''}</td>
                        <td>${item.hit || ''}</td>
                        <td>${item.crit || ''}</td>
                        <td>${item.skill || ''}</td>
                        <td>${item.type || ''}</td>
                        <td>${item.dps || ''}</td>
                    </tr>`;
        }

        table += '</tbody></table></section>';

        view.tcontainer.empty();
        view.tcontainer.append(table);
        view.tcontainer.find('table.gear').tablesorter({
            widthFixed: true,
            sortList: [[10, 1],[0, 0]],
        });

        view.loadEnchants(type);
    },

    loadEnchants: function (type) {
        var view = this;
        view.main.find('.js-enchant').hide();

        if (!enchant[type] || enchant[type].length == 0) return;

        let table = `<table class="enchant" data-type="${type}" data-max="1">
                        <thead>
                            <tr>
                                <th>Enchant</th>
                                <th>Str</th>
                                <th>Agi</th>
                                <th>AP</th>
                                <th>Haste</th>
                                <th>Crit</th>
                                <th>Damage</th>
                                <th>PPM</th>
                                <th>DPS</th>
                            </tr>
                        </thead>
                    <tbody>`;

        for (let item of enchant[type]) {

            if (item.phase && !view.filter.find('.phases [data-id="' + item.phase + '"]').hasClass('active'))
                continue;

            table += `<tr data-id="${item.id}" data-temp="${item.temp || false}" class="${item.selected ? 'active' : ''}">
                        <td><a href="https://classic.wowhead.com/${item.spellid ? 'spell' : 'item'}=${item.id}"></a>${item.name}</td>
                        <td>${item.str || ''}</td>
                        <td>${item.agi || ''}</td>
                        <td>${item.ap || ''}</td>
                        <td>${item.haste || ''}</td>
                        <td>${item.crit || ''}</td>
                        <td>${item.dmg || ''}</td>
                        <td>${item.ppm || ''}</td>
                        <td>${item.dps || ''}</td>
                    </tr>`;
        }

        table += '</tbody></table></section>';

        if ($(table).find('tbody tr').length == 0) return;

        view.tcontainer.append(table);
        view.tcontainer.find('table.enchant').tablesorter({
            widthFixed: true,
            sortList: [[8, 1],[0, 0]],
        });

        view.main.find('.js-enchant').show();
    },

    addAlert: function (msg) {
        var view = this;
        view.alerts.empty().append('<div class="alert"><p>' + msg + '</p></div>');
        view.alerts.find('.alert').click(function () { view.closeAlert(); });
        setTimeout(function () { view.alerts.find('.alert').addClass('in-up') });
        setTimeout(function () { view.closeAlert(); }, 4000);
    },
    
    closeAlert: function () {
        var view = this;
        view.alerts.find('.alert').removeClass('in-up');
        setTimeout(function () { view.alerts.empty(); }, 1000);
    }
    


};