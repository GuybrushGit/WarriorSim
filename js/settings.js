var SIM = SIM || {}

SIM.SETTINGS = {

    init: function () {
        var view = this;
        view.variables();
        view.events();
        view.buildSpells();
        view.buildBuffs();
        view.buildTalents();
        view.buildRunes();
    },

    variables: function () {
        var view = this;
        view.body = $('body');
        view.buffs = view.body.find('article.buffs');
        view.fight = view.body.find('article.fight');
        view.rotation = view.body.find('article.rotation');
        view.talents = view.body.find('article.talents');
        view.filter = view.body.find('article.filter');
        view.runes = view.body.find('article.runes');
        view.close = view.body.find('section.settings .btn-close');
        view.bg = view.body.find('section.sidebar .bg');
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-settings').removeClass('active');
            $('section.settings').removeClass('active');
            view.body.addClass('sidebar-mobile-open');
        });
        view.buffs.on('click', '.icon', function (e) {
            let obj = $(this).toggleClass('active');
            if (obj.hasClass('active')) {
                if (obj.data('group'))
                    obj.siblings().filter('[data-group="' + obj.data('group') + '"]').removeClass('active');
                if (obj.data('disable-spell'))
                    $('.rotation [data-id="' + obj.data('disable-spell') + '"]').removeClass('active');
            }
            for (let buff of buffs) {
                buff.active = view.buffs.find('[data-id="' + buff.id + '"]').hasClass('active');
            }
            e.stopPropagation();
            e.preventDefault();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.talents.on('click', '.icon', function (e) {
            let talent = view.getTalent($(this));
            let total = view.getTalentTotal($(this));
            if (total < talent.y * 5) return;

            let storage = JSON.parse(localStorage[mode + (globalThis.profileid || 0)]);
            let level = parseInt(storage.level);
            let count = 0;
            for (let tree of talents)
                for (let talent of tree.t)
                    count += talent.c;
            let available = Math.max(level - 9 - count, 0);
            if (available <= 0) return;

            talent.c = talent.c < talent.m ? talent.c + 1 : talent.m;
            $(this).attr('data-count', talent.c);
            if (talent.c >= talent.m) $(this).addClass('maxed');
            if (talent.enable)
                $('.rotation [data-id="' + talent.enable + '"]').removeClass('hidden');
            if (talent.enablename)
                $('.rotation [data-name="' + talent.enablename + '"]').removeClass('hidden');
            $(this).find('a').attr('href', WEB_DB_URL + 'spell=' + talent.s[talent.c == 0 ? 0 : talent.c - 1]);
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildSpells();
        });

        view.talents.on('contextmenu', '.icon', function (e) {
            e.preventDefault();
            let talent = view.getTalent($(this));
            if (talent.c < 1) return;
            talent.c--;

            let valid = true;
            let count = [];
            let tree = $(this).parents('table').index() - 2;
            for (let t of talents[tree].t)
                count[t.y] = (count[t.y] || 0) + t.c;
            for(let i = 0; i < count.length; i++)
                count[i] += count[i-1] || 0;
            for (let t of talents[tree].t)
                if (t.c && t.y * 5 > count[t.y - 1])
                    valid = false;
            if (!valid) {
                talent.c++;
                return;
            }

            $(this).attr('data-count', talent.c);
            $(this).removeClass('maxed');
            if (talent.c == 0 && talent.enable) {
                $('.rotation [data-id="' + talent.enable + '"]').removeClass('active').addClass('hidden');
                for (let spell of spells)
                    if (spell.id == talent.enable)
                        spell.active = false;
            }
            if (talent.c == 0 && talent.enablename) {
                $('.rotation [data-name="' + talent.enablename + '"]').removeClass('active').addClass('hidden');
                for (let spell of spells)
                    if (spell.name == talent.enablename)
                        spell.active = false;
            }
            $(this).find('a').attr('href', WEB_DB_URL + 'spell=' + talent.s[talent.c == 0 ? 0 : talent.c - 1]);
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.talents.on('click', '.js-talents-reset', function (e) {
            e.preventDefault();
            for (let tree of talents)
                for (let talent of tree.t)
                    talent.c = 0;
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildTalents();
            view.buildSpells();
        });

        view.filter.on('click', '.sources > li', function (e) {
            $(this).toggleClass('active');
            if ($(this).hasClass('active')) {
                let id = $(this).data('id');
                view.filter.find(`.phases [data-sources*="${id}"]`).addClass('active');
            }
            SIM.UI.updateSession();
            SIM.UI.filterGear();
            e.preventDefault();
        });

        view.filter.on('click', '.js-toggle, li ul', function(e) {
            e.stopPropagation();
            if (this.classList.contains("js-toggle")) {
                var toggleEle = this.getAttribute('data-id');
                $("."+toggleEle).toggleClass('hidden');
            }
        });

        view.filter.on('click', '.phases li', function (e) {
            $(this).toggleClass('active');
            let sources = $(this).data('sources').split(',');
            let show = $(this).hasClass('active');
            for (let source of sources) {
                if (show) view.filter.find('.sources [data-id="' + source + '"]').addClass('active');
                else view.filter.find('.sources [data-id="' + source + '"]').removeClass('active');
            }
            SIM.UI.updateSession();
            SIM.UI.filterGear();
        });

        view.buffs.on('click', 'label', function(e) {
            var view = this;
            $(view.parentElement).find('div').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.rotation.on('click', 'label', function(e) {
            var view = this;
            $(view.parentElement).find('div').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.fight.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('ul').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.talents.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('table').toggleClass('hidden').end().find('#top').toggleClass('hidden top');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.runes.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('div').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.filter.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('ul').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.fight.on('input', '.slider', function (e) {
            var val = $(this).val();
            $(this).next().val(val);
            $(this).next().trigger("keyup");
        });

        view.fight.on('change', 'select[name="race"]', function (e) {
            var val = $(this).val();
            view.bg.attr('data-race', val);

            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildSpells();
        });

        view.fight.on('change', 'select[name="aqbooks"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildSpells();
            view.buildBuffs();
        });

        view.fight.on('change', 'select[name="bleedreduction"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('change', 'select[name="spellqueueing"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('keyup', 'input[type="text"]', function (e) {
            e.stopPropagation();
            if (!view.body.find('.active[data-type="profiles"]').length)
                SIM.UI.filterGear();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildBuffs();
            view.buildSpells();
        });

        view.fight.on('change', 'select[name="batching"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('input', 'input[name="targetcustomarmor"]', function (e) {
            e.stopPropagation();
            let base = $('select[name="targetbasearmor"]').get(0);
            base.options[base.options.length - 1].innerHTML = $(this).val();

            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('change', 'select[name="targetbasearmor"]', function (e) {
            e.stopPropagation();
            let custom = $('input[name="targetcustomarmor"]');

            if (this.selectedOptions[0].dataset.custom) {
                this.selectedOptions[0].innerHTML = '';
                custom.val(0);
                custom.addClass('focus');
                custom.focus();
            }
            else {
                this.options[this.options.length - 1].innerHTML = 'Custom Value';
                custom.val('');
                custom.removeClass('focus');
            }

            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.rotation.on('click', '.spell a', function (e) {
            e.stopPropagation();
            e.preventDefault();
            let el = $(this).closest('.spell');
            let id = el.data('id');
            el.toggleClass('open');
            el.removeClass('fade');
            let isopen = el.hasClass("open");
            if (isopen) {
                el.siblings().addClass('fade');
                el.siblings('.open').each(function() {
                    $(this).removeClass('open');
                    view.hideSpellDetails($(this));
                });
            }
            else {
                el.siblings().removeClass('fade');
            }

            for (let spell of spells) {
                if (spell.id == id) {
                    if (isopen) view.buildSpellDetails(spell, el);
                    else view.hideSpellDetails(el);
                }
            }
        });

        view.rotation.on('click', '.details li:not(.nobox)', function (e) {
            if (e.target.nodeName !== "LI") return;
            $(this).toggleClass('active');
            let active = $(this).hasClass('active');
            let id = $(this).parents('.details').data('id');
            let spell;
            for (let s of spells) if (s.id == id) spell = s;

            if ($(this).data('id') == 'active' || $(this).data('id') == 'timetoendactive' || $(this).data('id') == 'timetostartactive') {

                if (e.originalEvent && e.originalEvent.isTrusted)
                    view.rotation.find(`.spell[data-id="${id}"]`).toggleClass('active', active);

                if (active && spell.name == "Heroic Strike") {
                    for (let s of spells) 
                        if (s.name == "Cleave" && s.active) {
                            s.active = false;
                            view.rotation.find(`.spell[data-id="${s.id}"]`).removeClass('active');
                        }
                }
                if (active && spell.name == "Cleave") {
                    for (let s of spells) 
                        if (s.name == "Heroic Strike" && s.active) {
                            s.active = false;
                            view.rotation.find(`.spell[data-id="${s.id}"]`).removeClass('active');
                        }
                }
            }

            if (active && $(this).data('group')) {
                $(this).siblings(`.active[data-group="${$(this).data('group')}"]`).click();
            }

            spell[$(this).data('id')] = active;

            if (e.originalEvent && e.originalEvent.isTrusted && ($(this).data('id') == 'timetoendactive' || $(this).data('id') == 'timetostartactive')) {
                spell.active = active;
            }
            
            SIM.UI.updateSession();
        });

        view.rotation.on('keyup', '.details input', function (e) {
            let id = $(this).parents('.details').data('id');

            for (let spell of spells)
                if (spell.id == id)
                    spell[$(this).attr('name')] = $(this).val();

            SIM.UI.updateSession();
        });

        view.rotation.on('change', '.details select', function (e) {
            let id = $(this).parents('.details').data('id');

            for (let spell of spells)
                if (spell.id == id)
                    spell[$(this).attr('name')] = $(this).val();

            SIM.UI.updateSession();
        });

    },

    buildSpells: function () {
        const view = this;
        let storage = JSON.parse(localStorage[mode + (globalThis.profileid || 0)]);
        let level = parseInt(storage.level);
        let container = view.rotation.find('div:first');
        container.empty();
        if (view.rotation.find('.open')) view.hideSpellDetails(view.rotation.find('.open'))

        let buffs = '';
        let items = '';
        for (let spell of spells) {

            if (spell.sod && mode !== "sod") {
                spell.active = false;
                continue;
            }

            // race restriction
            if (spell.id == 26296 && storage.race !== "Troll") {
                spell.active = false;
                continue;
            }
            if (spell.id == 20572 && storage.race !== "Orc") {
                spell.active = false;
                continue;
            }

            // level restriction
            let min = parseInt(spell.minlevel || 0);
            let max = parseInt(spell.maxlevel || 60);
            if (level < min || level > max) {
                spell.active = false;
                continue;
            }

            // talent restriction
            let talent;
            for (let tree of talents)
                for (let t of tree.t)
                    if (t.n == spell.name) talent = t;
            if (talent && talent.enable && talent.c == 0) {
                spell.active = false;
                continue;
            }

            // rune restrictions
            let rune;
            if (typeof runes !== 'undefined') {
                for (let type in runes)
                    for (let r of runes[type])
                        if (r.enable == spell.id) rune = r;
                if (rune && !rune.selected) {
                    spell.active = false;
                    continue;
                }
            }
            else if (spell.rune) {
                spell.active = false;
                continue;
            }

            // aoe restriction
            if (storage.adjacent == 0 && spell.name == "Cleave") {
                spell.active = false;
                continue;
            }

            // aq restriction
            if (storage.aqbooks == "Yes" && typeof spell.aq !== 'undefined' && spell.aq === false) {
                spell.active = false;
                continue;
            }
            if (storage.aqbooks == "No" && spell.aq) {
                spell.active = false;
                continue;
            }

            // item restriction
            if (spell.item) {
                let item;
                for (let type in gear)
                    for (let g of gear[type])
                        if (spell.id == g.id && g.selected) item = g;

                if (!item) {
                    spell.active = false;
                    continue;
                }
                else if (spell.timetoendactive || spell.timetostartactive) {
                    spell.active = true;
                }
            }

            // Might set bonus
            if (spell.itemblock) { 
                let count = 0;
                let items = [226499,226497,226494,226495,226493,226492,226498,226496,232251,232249,232254,232247,232252,232248,232250,232253];
                for (let type in gear)
                    for (let g of gear[type])
                        if (g.selected && items.includes(g.id)) count++;
                if (count < 4) {
                    spell.active = false;
                    continue;
                }
                spell.active = true;
            }

            let div = $(`<div data-id="${spell.id}" data-name="${spell.name}" class="spell ${spell.active ? 'active' : ''}"><div class="icon">
            <img src="https://wow.zamimg.com/images/wow/icons/medium/${spell.iconname.toLowerCase()}.jpg " alt="${spell.name}">
            <a href="${WEB_DB_URL}${spell.item ? 'item' : 'spell'}=${spell.id}" class="wh-tooltip"></a>
            </div></div>`);

            if (spell.buff) buffs += div[0].outerHTML;
            else if (spell.item || spell.itemblock) items += div[0].outerHTML;
            else container.append(div);

        }

        container.append($('<div class="label">Buffs</div>'));
        container.append(buffs);

        if (items.length > 0) {
            container.append($('<div class="label">Items</div>'));
            container.append(items);
        }
        


    },

    buildSpellDetails(spell, el) {
        const view = this;
        let note = '';
        let details = view.rotation.find('.details');
        details.data('id',spell.id);
        details.empty();
        details.append(`<label>${spell.name}</label>`);
        let ul = $("<ul></ul>");

        if (spell.haste !== undefined)
            ul.append(`<li class="nobox ${spell.haste ? 'active' : ''}">Attack speed set at <input type="text" name="haste" value="${spell.haste}" data-numberonly="true" /> %</li>`);

        if (typeof spell.priority !== 'undefined')
            ul.append(`<li data-id="priority" class="nobox active">Priority <select name="priority">
              <option value="0" ${spell.priority == 0 ? 'selected' : ''}>Not used</option>
              <option value="1" ${spell.priority == 1 ? 'selected' : ''}>1</option>
              <option value="2" ${spell.priority == 2 ? 'selected' : ''}>2</option>
              <option value="3" ${spell.priority == 3 ? 'selected' : ''}>3</option>
              <option value="4" ${spell.priority == 4 ? 'selected' : ''}>4</option>
              <option value="5" ${spell.priority == 5 ? 'selected' : ''}>5</option>
              <option value="6" ${spell.priority == 6 ? 'selected' : ''}>6</option>
              <option value="7" ${spell.priority == 7 ? 'selected' : ''}>7</option>
              <option value="8" ${spell.priority == 8 ? 'selected' : ''}>8</option>
              <option value="9" ${spell.priority == 9 ? 'selected' : ''}>9</option>
              <option value="10" ${spell.priority == 10 ? 'selected' : ''}>Highest</option>
            </select></li>`);

        if (typeof spell.expriority !== 'undefined')
            ul.append(`<li data-id="expriority" class="nobox active">Execute phase <select name="expriority">
                <option value="0" ${spell.expriority == 0 ? 'selected' : ''}>Not used</option>
                <option value="1" ${spell.expriority == 1 ? 'selected' : ''}>1</option>
                <option value="2" ${spell.expriority == 2 ? 'selected' : ''}>2</option>
                <option value="3" ${spell.expriority == 3 ? 'selected' : ''}>3</option>
                <option value="4" ${spell.expriority == 4 ? 'selected' : ''}>4</option>
                <option value="5" ${spell.expriority == 5 ? 'selected' : ''}>5</option>
                <option value="6" ${spell.expriority == 6 ? 'selected' : ''}>6</option>
                <option value="7" ${spell.expriority == 7 ? 'selected' : ''}>7</option>
                <option value="8" ${spell.expriority == 8 ? 'selected' : ''}>8</option>
                <option value="9" ${spell.expriority == 9 ? 'selected' : ''}>9</option>
                <option value="10" ${spell.expriority == 10 ? 'selected' : ''}>Highest</option>
            </select></li>`);

        if (typeof spell.timetoend === 'undefined' && !spell.noactiveoption)
            ul.append(`<li data-id="active" class="${spell.active ? 'active' : ''}">Enabled ${note ? ` - ${note}` : ''}</li>`);
        if (typeof spell.afterswing !== 'undefined') 
            ul.append(`<li data-id="afterswing" class="${spell.afterswing ? 'active' : ''}">Use only after a swing reset</li>`);
        if (typeof spell.minrage !== 'undefined' && spell.id != 11597) 
            ul.append(`<li data-id="minrageactive" class="${spell.minrageactive ? 'active' : ''}">${spell.name == "Heroic Strike" ? 'Queue' : 'Use'} when above <input type="text" name="minrage" value="${spell.minrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.minrage !== 'undefined' && spell.id == 11597) 
            ul.append(`<li data-id="minrageactive" class="${spell.minrageactive ? 'active' : ''}" data-group="usage">Only use when above <input type="text" name="minrage" value="${spell.minrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.maxrage !== 'undefined') 
            ul.append(`<li data-id="maxrageactive" class="${spell.maxrageactive ? 'active' : ''}">Don't switch stance when above <input type="text" name="maxrage" value="${spell.maxrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.maincd !== 'undefined') 
            ul.append(`<li data-id="maincdactive" class="${spell.maincdactive ? 'active' : ''}">Don't ${spell.name == "Heroic Strike" ? 'queue' : 'use'} if BT / MS cooldown shorter than <input type="text" name="maincd" value="${spell.maincd}" data-numberonly="true" /> seconds</li>`);
        if (typeof spell.duration !== 'undefined') 
            ul.append(`<li data-id="durationactive" class="${spell.durationactive ? 'active' : ''}" data-group="usage">Only use every <input type="text" name="duration" value="${spell.duration}" data-numberonly="true" /> seconds</li>`);
        if (typeof spell.unqueue !== 'undefined') 
            ul.append(`<li data-id="unqueueactive" class="${spell.unqueueactive ? 'active' : ''}">Unqueue if below <input type="text" name="unqueue" value="${spell.unqueue}" data-numberonly="true" /> rage before MH swing</li>`);
        if (typeof spell.exmacro !== 'undefined') 
            ul.append(`<li data-id="exmacro" class="${spell.exmacro ? 'active' : ''}" data-group="ex">Always queue when casting Execute</li>`);
        if (spell.timetostart !== undefined)
            ul.append(`<li data-id="timetostartactive" data-group="timeto" class="${spell.timetostartactive ? 'active' : ''}">Use <input type="text" name="timetostart" value="${spell.timetostart}" data-numberonly="true" /> seconds from the start of the fight</li>`);
        if (spell.timetoend !== undefined)
            ul.append(`<li data-id="timetoendactive" data-group="timeto" class="${spell.timetoendactive ? 'active' : ''}">Use <input type="text" name="timetoend" value="${spell.timetoend}" data-numberonly="true" /> seconds from the end of the fight</li>`);
        if (spell.priorityap !== undefined)
            ul.append(`<li data-id="priorityapactive" class="${spell.priorityapactive ? 'active' : ''}">Don't use if Attack Power is higher than <input type="text" name="priorityap" value="${spell.priorityap}" data-numberonly="true" style="width: 25px" /></li>`);
        if (spell.procblock !== undefined)
            ul.append(`<li data-id="procblock" class="${spell.procblock ? 'active' : ''}">Don't use rage until it procs</li>`);
        if (spell.rageblock !== undefined)
            ul.append(`<li data-id="rageblockactive" class="${spell.rageblockactive ? 'active' : ''}">Don't use rage below <input type="text" name="rageblock" value="${spell.rageblock}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.globals !== 'undefined') 
            ul.append(`<li data-id="globalsactive" class="${spell.globalsactive ? 'active' : ''}" data-group="usage">Only use on first <input type="text" name="globals" value="${spell.globals}" data-numberonly="true" /> globals</li>`);
        if (spell.chargeblock !== undefined)
            ul.append(`<li data-id="chargeblockactive" class="${spell.chargeblockactive ? 'active' : ''}">Don't use rage below <input type="text" name="chargeblock" value="${spell.chargeblock}" data-numberonly="true" /> CbR charges</li>`);
        if (spell.erageblock !== undefined)
            ul.append(`<div class="label">Execute Phase:</div><li data-id="erageblockactive" class="${spell.erageblockactive ? 'active' : ''}">Don't use rage below <input type="text" name="erageblock" value="${spell.erageblock}" data-numberonly="true" /> rage</li>`);
        if (spell.echargeblock !== undefined)
            ul.append(`<li data-id="echargeblockactive" class="${spell.echargeblockactive ? 'active' : ''}">Don't use rage below <input type="text" name="echargeblock" value="${spell.echargeblock}" data-numberonly="true" /> CbR charges</li>`);
        if (spell.alwaysheads !== undefined)
            ul.append(`<li data-id="alwaysheads" data-group="coinflip" class="${spell.alwaysheads ? 'active' : ''}">Always heads</li>`);
        if (spell.alwaystails !== undefined)
            ul.append(`<li data-id="alwaystails" data-group="coinflip" class="${spell.alwaystails ? 'active' : ''}">Always tails</li>`);
        if (spell.zerkerpriority !== undefined)
            ul.append(`<li data-id="zerkerpriority" class="${spell.zerkerpriority ? 'active' : ''}">Prioritize over Bloodrage</li>`);
        if (typeof spell.resolve !== 'undefined') 
            ul.append(`<li data-id="resolve" class="${spell.resolve ? 'active' : ''}">Only use if Defender's Resolve is not up</li>`);
        if (typeof spell.swordboard !== 'undefined') 
            ul.append(`<li data-id="swordboard" class="${spell.swordboard ? 'active' : ''}">Only use after a Sword & Board proc</li>`);
        if (typeof spell.swingtimer !== 'undefined') 
            ul.append(`<li data-id="swingtimeractive" class="${spell.swingtimeractive ? 'active' : ''}">Don't use if swing timer longer than <input type="text" name="swingtimer" value="${spell.swingtimer}" data-numberonly="true" /> secs</li>`);


        // Might set
        if (typeof spell.secondarystance !== 'undefined')
            ul.append(`<li data-id="secondarystance" class="nobox active">Secondary stance <select name="secondarystance">
                <option value="battle" ${spell.secondarystance == 'battle' ? 'selected' : ''}>Battle Stance</option>
                <option value="def" ${spell.secondarystance == 'def' ? 'selected' : ''}>Defensive Stance</option>
                <option value="zerk" ${spell.secondarystance == 'zerk' ? 'selected' : ''}>Berserker Stance</option>
                <option value="glad" ${spell.secondarystance == 'glad' ? 'selected' : ''}>Gladiator Stance</option></option>
            </select></li>`);

        if (typeof spell.switchstart !== 'undefined')
            ul.append(`<li data-id="switchstart" class="${spell.switchstart ? 'active' : ''}">Switch stance at fight start</li>`);
        if (typeof spell.switchtimeactive !== 'undefined')
            ul.append(`<li data-id="switchtimeactive" class="${spell.switchtimeactive ? 'active' : ''}">Switch if any Forecast shorter than <input type="text" name="switchtime" value="${spell.switchtime}" data-numberonly="true" /> secs AND rage below <input type="text" name="switchrage" value="${spell.switchrage}" data-numberonly="true" /></li>`);
        if (typeof spell.switchoractive !== 'undefined')
            ul.append(`<li data-id="switchoractive" class="${spell.switchoractive ? 'active' : ''}">Switch if any Forecast shorter than <input type="text" name="switchortime" value="${spell.switchortime}" data-numberonly="true" /> secs OR rage below <input type="text" name="switchorrage" value="${spell.switchorrage}" data-numberonly="true" /></li>`);
        if (typeof spell.switchechoesactive !== 'undefined')
            ul.append(`<li data-id="switchechoesactive" class="${spell.switchechoesactive ? 'active' : ''}">Switch if any Echoes shorter than <input type="text" name="switchechoestime" value="${spell.switchechoestime}" data-numberonly="true" /> secs and rage below <input type="text" name="switchechoesrage" value="${spell.switchechoesrage}" data-numberonly="true" /></li>`);
        if (typeof spell.switchdefault !== 'undefined')
            ul.append(`<li data-id="switchdefault" class="${spell.switchdefault ? 'active' : ''}">Switch back to default stance as soon as possible</li>`);


        details.css('visibility','hidden');
        details.append(ul);
        let height = details.height();
        
        setTimeout(function() {
            details.css('visibility','');
            el.css('margin-bottom', height + 30 + 'px');
            details.css('top', el.position().top + 74 + 'px');
            details.addClass('visible');
        }, 200);
        
        
    },

    hideSpellDetails(el) {
        const view = this;
        let details = view.rotation.find('.details');
        details.removeClass('visible');
        el.css('margin-bottom', '0px');
        
    },

    toggleArticle: function(label) {
        if (label.classList.contains("active")) {
            label.classList.add("inactive")
            label.classList.remove("active")
        } else {
            label.classList.add("active")
            label.classList.remove("inactive")
        }
    },

    buildBuffs: function () {
        var view = this;
        view.buffs.empty();
        view.buffs.append('<label class="active">Buffs</label>');
        let storage = JSON.parse(localStorage[mode + (globalThis.profileid || 0)]);
        let level = parseInt(storage.level);
        let worldbuffs = '', consumes = '', other = '', armor = '', stances = '', skills = '';
        for (let buff of buffs) {

            // level restrictions
            let min = parseInt(buff.minlevel || 0);
            let max = parseInt(buff.maxlevel || 60);
            if (level < min || level > max) {
                buff.active = false;
                continue;
            }

            // aq restrictions
            if (storage.aqbooks == "Yes" && typeof buff.aq !== 'undefined' && buff.aq === false) {
                buff.active = false;
                continue;
            }
            if (storage.aqbooks == "No" && buff.aq) {
                buff.active = false;
                continue;
            }

            // sod restrictions
            if (mode !== "sod" && buff.sod) {
                buff.active = false;
                continue;
            }

            // rune restrictions
            let rune;
            if (typeof runes !== 'undefined') {
                for (let type in runes)
                    for (let r of runes[type])
                        if (r.enable == buff.id) rune = r;
                if (rune && !rune.selected) {
                    buff.active = false;
                    continue;
                }
            }
            else if (buff.rune) {
                buff.active = false;
                continue;
            }

            let tooltip = buff.id;
            if (buff.id == 413479) tooltip = 412513;

            let wh = buff.spellid ? 'spell' : 'item';
            let active = buff.active ? 'active' : '';
            let group = buff.group ? `data-group="${buff.group}"` : '';
            let disable = buff.disableSpell ? `data-disable-spell="${buff.disableSpell}"` : '';
            let html = `<div data-id="${buff.id}" class="icon ${active}" ${group} ${disable}>
                            <img src="https://wow.zamimg.com/images/wow/icons/medium/${buff.iconname.toLowerCase()}.jpg " alt="${buff.name}">
                            <a href="${WEB_DB_URL}${wh}=${tooltip}" class="wh-tooltip"></a>
                        </div>`;
            if (buff.worldbuff) worldbuffs += html;
            else if (buff.stance) stances += html;
            else if (buff.consume) consumes += html;
            else if (buff.other) other += html;
            else if (buff.armor || buff.improvedexposed) armor += html;
            else if (buff.skill) skills += html;
            else view.buffs.append(html);
        }
        
        view.buffs.append('<div class="label">Consumables</div>');
        view.buffs.append(consumes);
        view.buffs.append('<div class="label">World Buffs</div>');
        view.buffs.append(worldbuffs);
        view.buffs.append('<div class="label">Other</div>');
        view.buffs.append(other);
        view.buffs.append(`<div class="label">Target's Armor (Current: <span id="currentarmor"></span>)</div>`);
        view.buffs.append(armor);
        view.buffs.append('<div class="label">Default Stance</div>');
        view.buffs.append(stances);
        view.buffs.append('<div class="label">Skill Specialization</div>');
        view.buffs.append(skills);
        SIM.UI.updateSession();
        SIM.UI.updateSidebar();
    },

    buildTalents: function () {
        var view = this;
        view.talents.find('table').remove();
        for (let tree of talents) {
            let table = $('<table><tr><th colspan="4">' + tree.n + '</th></tr></table>');
            for (let i = 0; i < 7; i++) table.prepend('<tr><td></td><td></td><td></td><td></td></tr>');
            for (let talent of tree.t) {
                let div = $('<div class="icon" data-count="' + talent.c + '" data-x="' + talent.x + '" data-y="' + talent.y + '"></div>');
                div.html('<img src="https://wow.zamimg.com/images/wow/icons/medium/' + talent.iconname.toLowerCase() + '.jpg" alt="' + talent.n + '" />');
                if (talent.c >= talent.m) div.addClass('maxed');
                div.append(`<a href="${WEB_DB_URL}spell=` + talent.s[talent.c == 0 ? 0 : talent.c - 1] + `" class="wh-tooltip"></a>`);
                table.find('tr').eq(talent.y).children().eq(talent.x).append(div);
            }
            view.talents.append(table);
        }
    },

    buildRunes: function () {
        var view = this;
        if (typeof runes === "undefined") return;
        view.runes.find('#runes-area').empty();
        for (let type in runes) {
            for (let i in runes[type]) {
                let rune = runes[type][i];
                if (rune.enable && rune.selected) view.rotation.find('[data-id="' + rune.enable + '"]').removeClass('hidden');
                if (rune.enable && !rune.selected) view.rotation.find('[data-id="' + rune.enable + '"]').addClass('hidden');

                // Glad Stance
                if (rune.selected && rune.gladstance) view.buffs.find('[data-id="' + rune.enable + '"]').removeClass('hidden');
                if (!rune.selected && rune.gladstance) view.buffs.find('[data-id="' + rune.enable + '"]').addClass('hidden');
            }
        }
        var type_of_runes = $('nav > ul > li').map(function() {
            return $(this).data('type');
          }).get();
        for (let tree_name of type_of_runes) {
            if (!runes.hasOwnProperty(tree_name)) {
            } else {
                let table = $('<table>');
                let tbody = $('<tbody>');
                let tree = $(`<tr name="${tree_name}">`)
                for(let i = 0; i < runes[tree_name].length; i++) {
                    let this_rune = runes[tree_name][i];
                    let td = $('<td>');
                    let rune_div = $(`<div data-id="${this_rune.id}" class="rune"></div>`);
                    let sub_div = $(`<div class="icon ${this_rune.selected ? 'active' : ''}"></div>`);
                    let tooltip = this_rune.id;
                    if (tooltip == 413479) tooltip = 412513;
                    sub_div.html(`<img src="https://wow.zamimg.com/images/wow/icons/medium/${this_rune.iconname}.jpg" alt="${this_rune.name}" />`);
                    sub_div.append(`<a href="${WEB_DB_URL}spell=${tooltip}" class="wh-tooltip"></a>`);
                    rune_div.append(sub_div);
                    td.append(rune_div); 
                    tree.append(td);
                }
                let tr = $('<tr>');
                let tree_header = $(`<th style="text-align:left; padding-left: 4px;">${tree_name.toString().charAt(0).toUpperCase()}${tree_name.slice(1).toString().replace('1','')}</th>`)
                tr.append(tree_header)
                // if (tree_name == "legs")
                //     tree.append('<td><div id="move" class="rune" style="position: absolute; z-index: 999; margin-top: -23px;"><div class="icon"><img src="https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_titansgrip.jpg" alt="" /></div></div></td>');
                
                table.append(tr).append(tree);
                tbody.append(table)
                view.runes.find('#runes-area').append(tbody);

                $("#move").mouseenter(function () {

                    $(this).animate({
                        top: Math.random() * 300
                    }, 100);
                    $(this).animate({
                        left: Math.random() * 300
                    }, 100);
                
                });
            }
        }
    },

    getTalent: function (div) {
        let tree = div.parents('table').index() - 1;
        let x = div.data('x');
        let y = div.data('y');
        for (let talent of talents[tree - 1].t)
            if (talent.x == x && talent.y == y)
                return talent;
    },

    getTalentTotal: function (div) {
        let tree = div.parents('table').index() - 1;
        let count = 0;
        for (let talent of talents[tree - 1].t)
            count += parseInt(talent.c);
        return count;
    }

};
