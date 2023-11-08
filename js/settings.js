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
        view.close = view.body.find('section.settings .btn-close');
        view.bg = view.body.find('section.sidebar .bg');
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-settings').removeClass('active');
            $('section.settings').removeClass('active');
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

            let storage = JSON.parse(localStorage[mode]);
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
            $(this).find('a').attr('href', 'https://classic.wowhead.com/spell=' + talent.s[talent.c == 0 ? 0 : talent.c - 1]);
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildSpells();
        });

        view.talents.on('contextmenu', '.icon', function (e) {
            e.preventDefault();
            let talent = view.getTalent($(this));
            talent.c = talent.c < 1 ? 0 : talent.c - 1;
            $(this).attr('data-count', talent.c);
            $(this).removeClass('maxed');
            if (talent.c == 0 && talent.enable) {
                $('.rotation [data-id="' + talent.enable + '"]').removeClass('active').addClass('hidden');
                for (let spell of spells)
                    if (spell.id == talent.enable)
                        spell.active = false;
            }
            $(this).find('a').attr('href', 'https://classic.wowhead.com/spell=' + talent.s[talent.c == 0 ? 0 : talent.c - 1]);
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

        view.rotation.on('click', '.spell', function (e) {
            let t = e.target;
            if (t.nodeName == "LI" || t.nodeName == "INPUT")
                return;
            $(this).toggleClass('active');
            let id = $(this).data('id');
            for (let spell of spells) {
                if (spell.id == id)
                    spell.active = $(this).hasClass('active');
            }
            SIM.UI.updateSession();
        });

        view.rotation.on('keyup', 'input[type="text"]', function (e) {
            let id = $(this).parents('.spell').data('id');
            for (let spell of spells) {
                if (spell.id == id)
                    spell[$(this).attr('name')] = $(this).val();
            }
            SIM.UI.updateSession();
        });

        view.buffs.on('click', 'label', function(e) {
            var view = this;
            $(view.parentElement).find('div').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.fight.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('ul').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.rotation.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('div:first').toggleClass('hidden');
            SIM.SETTINGS.toggleArticle(view);
        });

        view.talents.on('click', 'label', function (e) {
            var view = this;
            $(view.parentElement).find('table').toggleClass('hidden');
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
            var bloodfury = view.rotation.find('[data-id="20572"]');
            var berserking = view.rotation.find('[data-id="26296"]');
            var disableSpells = [];

            if (val == "Orc") {
                bloodfury.removeClass('hidden');
            }
            else {
                bloodfury.addClass('hidden').removeClass('active');
                disableSpells.push(20572);
            }
            if (val == "Troll") {
                berserking.removeClass('hidden');
            }
            else {
                berserking.addClass('hidden').removeClass('active');
                disableSpells.push(26296);
            }

            for (let spell of spells) {
                if (disableSpells.includes(spell.id))
                    spell.active = false;
            }

            view.bg.attr('data-race', val);

            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('change', 'select[name="aqbooks"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('keyup', 'input[type="text"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
            view.buildBuffs();
            view.buildSpells();
        });

        view.fight.on('change', 'select[name="weaponrng"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.fight.on('change', 'select[name="batching"]', function (e) {
            e.stopPropagation();
            SIM.UI.updateSession();
            SIM.UI.updateSidebar();
        });

        view.rotation.on('click', '.spell2', function (e) {
            e.stopPropagation();
            
        });

        view.rotation.on('click', '.spell2 a', function (e) {
            e.stopPropagation();
            e.preventDefault();
            let el = $(this).closest('.spell2');
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

        view.rotation.on('click', '.details li', function (e) {
            if (e.target.nodeName !== "LI") return;
            $(this).toggleClass('active');
            let active = $(this).hasClass('active');
            let id = $(this).parents('.details').data('id');

            if ($(this).data('id') == 'active') {
                view.rotation.find(`.spell2[data-id="${id}"]`).toggleClass('active', active);
            }

            if (active && $(this).data('group')) {
                $(this).siblings(`.active[data-group="${$(this).data('group')}"]`).click();
            }

            for (let spell of spells)
                if (spell.id == id)
                    spell[$(this).data('id')] = active;

            SIM.UI.updateSession();
        });

        view.rotation.on('keyup', '.details input', function (e) {
            let id = $(this).parents('.details').data('id');

            for (let spell of spells)
                if (spell.id == id)
                    spell[$(this).attr('name')] = $(this).val();

            SIM.UI.updateSession();
        });

    },



    buildSpells2: function () {
        const view = this;
        let storage = JSON.parse(localStorage[mode]);
        let level = parseInt(storage.level);
        let container = view.rotation.find('div:first');
        container.empty();
        if (view.rotation.find('.open')) view.hideSpellDetails(view.rotation.find('.open'))

        for (let spell of spells) {

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

            let div = $(`<div data-id="${spell.id}" class="spell2 ${spell.active ? 'active' : ''}"><div class="icon">
            <img src="/dist/img/${spell.iconname.toLowerCase()}.jpg " alt="${spell.name}">
            <a href="https://classic.wowhead.com/spell=${spell.id}" class="wh-tooltip"></a>
            </div></div>`);

            container.append(div);

        }


    },

    buildSpellDetails(spell, el) {
        const view = this;
        let details = view.rotation.find('.details');
        details.data('id',spell.id);
        details.empty();
        details.append(`<label>${spell.name}</label>`);
        let ul = $("<ul></ul>");

        if (typeof spell.globals === 'undefined' && typeof spell.timetoend === 'undefined')
            ul.append(`<li data-id="active" class="${spell.active ? 'active' : ''}">Enabled</li>`);
        if (typeof spell.minrage !== 'undefined') 
            ul.append(`<li data-id="minrageactive" class="${spell.minrageactive ? 'active' : ''}">${spell.name == "Heroic Strike" ? 'Queue' : 'Use'} when above <input type="text" name="minrage" value="${spell.minrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.maxrage !== 'undefined') 
            ul.append(`<li data-id="maxrageactive" class="${spell.maxrageactive ? 'active' : ''}">Don't use when above <input type="text" name="maxrage" value="${spell.maxrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.maincd !== 'undefined') 
            ul.append(`<li data-id="maincdactive" class="${spell.maincdactive ? 'active' : ''}">Don't ${spell.name == "Heroic Strike" ? 'queue' : 'use'} if BT / MS cooldown shorter than <input type="text" name="maincd" value="${spell.maincd}" data-numberonly="true" /> seconds</li>`);
        if (typeof spell.duration !== 'undefined') 
            ul.append(`<li data-id="durationactive" class="${spell.durationactive ? 'active' : ''}">Only use every <input type="text" name="duration" value="${spell.duration}" data-numberonly="true" /> seconds</li>`);
        if (typeof spell.unqueue !== 'undefined') 
            ul.append(`<li data-id="unqueueactive" class="${spell.unqueueactive ? 'active' : ''}">Unqueue if below <input type="text" name="unqueue" value="${spell.unqueue}" data-numberonly="true" /> rage before MH swing</li>`);
        if (typeof spell.exmacro !== 'undefined') 
            ul.append(`<li data-id="exmacro" class="${spell.exmacro ? 'active' : ''}" data-group="ex">Execute phase: Always queue when casting Execute</li>`);
        if (typeof spell.exminrage !== 'undefined') 
            ul.append(`<li data-id="exminrageactive" class="${spell.exminrageactive ? 'active' : ''}" data-group="ex">Execute phase: Queue when above <input type="text" name="exminrage" value="${spell.exminrage}" data-numberonly="true" /> rage</li>`);
        if (typeof spell.exunqueue !== 'undefined') 
            ul.append(`<li data-id="exunqueueactive" class="${spell.exunqueueactive ? 'active' : ''}">Execute phase: Unqueue if below <input type="text" name="exunqueue" value="${spell.exunqueue}" data-numberonly="true" /> rage before MH swing</li>`);
        if (typeof spell.globals !== 'undefined') 
            ul.append(`<li data-id="active" class="${spell.active ? 'active' : ''}">Use on first <input type="text" name="globals" value="${spell.globals}" data-numberonly="true" /> globals</li>`);
        if (spell.timetoend !== undefined)
            ul.append(`<li data-id="active" class="${spell.active ? 'active' : ''}">Use on last <input type="text" name="timetoend" value="${spell.timetoend}" data-numberonly="true" /> seconds of the fight</li>`);

        // if (spell.crusaders !== undefined)
        //     ul.append(`<li data-id="active" class="${spell.crusaders ? 'active' : ''}">Use when <input type="text" name="timetoend" value="${spell.timetoend}" data-numberonly="true" /> seconds of the fight</li>`);



        details.append(ul);


        el.css('margin-bottom', details.height() + 40 + 'px');
        details.addClass('visible');
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

    buildSpells: function () {
        this.buildSpells2();
        return;
        var view = this;
        let storage = JSON.parse(localStorage[mode]);
        view.rotation.find('div:first').empty();
        for (let spell of spells) {
            let tooltip = spell.id == 115671 ? 11567 : spell.id;
            let div = $(`<div data-id="${spell.id}" class="spell"><div class="icon">
            <img src="/dist/img/${spell.iconname.toLowerCase()}.jpg " alt="${spell.name}">
            <a href="https://classic.wowhead.com/spell=${tooltip}" class="wh-tooltip"></a>
            </div><ul class="options"></ul></div>`);

            if (spell.timetoend !== undefined)
                div.find('.options').append(`<li>Use on last <input type="text" name="timetoend" value="${spell.timetoend}" data-numberonly="true" /> seconds</li>`);
            if (spell.minrage !== undefined)
                div.find('.options').append(`<li>Use when above <input type="text" name="minrage" value="${spell.minrage}" data-numberonly="true" /> rage</li>`);
            if (spell.maxrage !== undefined)
                div.find('.options').append(`<li>Use when below <input type="text" name="maxrage" value="${spell.maxrage}" data-numberonly="true" /> rage</li>`);
            if (spell.globals !== undefined)
                div.find('.options').append(`<li>Use on first <input type="text" name="globals" value="${spell.globals}" data-numberonly="true" /> globals</li>`);
            if (spell.maincd !== undefined)
                div.find('.options').append(`<li>BT/MS cooldown >= <input type="text" name="maincd" value="${spell.maincd}" data-numberonly="true" /> secs</li>`);
            if (spell.crusaders !== undefined)
                div.find('.options').append(`<li>when <input type="text" name="crusaders" value="${spell.crusaders}" data-numberonly="true" /> crusaders are up</li>`);
            if (spell.haste !== undefined)
                div.find('.options').append(`<li>Attack speed at <input type="text" name="haste" value="${spell.haste}" data-numberonly="true" /> %</li>`);
            if (spell.priorityap !== undefined)
                div.find('.options').append(`<li>Prioritize BT/MS when >= <input style="width:25px" type="text" name="priorityap" value="${spell.priorityap}" data-numberonly="true" /> AP</li>`);
            if (spell.id == 23255)
                div.find('.options').append(`<li>Include Deep Wounds damage</li>`);
            if (spell.id == 11605)
                div.find('.options').append(`<li>Slam macro with MH swing</li>`);
            if (spell.id == 2687 || spell.id == 18499)
                div.find('.options').append('<li>Used on cooldown below 80 rage</li>');
            if (spell.reaction !== undefined)
                div.find('.options').append(`<li><input style="width:25px" type="text" name="reaction" value="${spell.reaction}" data-numberonly="true" /> ms reaction time</li>`);
            if (spell.hidden)
                div.addClass('hidden');
            if (storage.race == "Orc" && spell.id == 20572)
                div.removeClass('hidden');
            if (storage.race == "Troll" && spell.id == 26296)
                div.removeClass('hidden');
            if (spell.active)
                div.addClass('active');

            if (spell.maincd !== undefined) {
                div.find('.options li:first-of-type').append(' or');
            }

            if (spell.crusaders !== undefined) {
                div.find('.options li:first-of-type').append(' or');
            }

            if (spell.id == 11567) {
                div.find('.options').empty();
                div.find('.options').append(`<li>Queue when above <input type="text" name="minrage" value="30" data-numberonly="true"> rage or BT/MS cooldown >= <input type="text" name="maincd" value="4" data-numberonly="true"> secs</li>`);
                div.find('.options').append(`<li>Unqueue if below <input type="text" name="unqueue" value="${spell.unqueue}" data-numberonly="true" /> rage, <input type="text" name="unqueuetimer" value="${spell.unqueuetimer}" data-numberonly="true" /> ms before MH swing</li>`);
                div.find('.options').append(`<li><input style="width:25px" type="text" name="reaction" value="${spell.reaction}" data-numberonly="true" /> ms reaction time</li>`);
            }

            if (spell.id == 115671) {
                div.find('.options').empty();
                div.find('.options').before('<label>Execute phase HS:</label>');
                div.find('.options').append(`<li>Queue when above <input type="text" name="minrage" value="30" data-numberonly="true"> rage</li>`);
                div.find('.options').append(`<li>Unqueue if below <input type="text" name="unqueue" value="${spell.unqueue}" data-numberonly="true" /> rage, <input type="text" name="unqueuetimer" value="${spell.unqueuetimer}" data-numberonly="true" /> ms before MH swing</li>`);
                div.find('.options').append(`<li><input style="width:25px" type="text" name="reaction" value="${spell.reaction}" data-numberonly="true" /> ms reaction time</li>`);
            }

            if (spell.id == 11585) {
                div.find('.options').empty();
                div.find('.options').append(`<li>Use when below <input type="text" name="maxrage" value="${spell.maxrage}" data-numberonly="true" /> rage and</li>`);
                div.find('.options').append(`<li>BT/MS cooldown >= <input type="text" name="maincd" value="${spell.maincd}" data-numberonly="true" /> secs</li>`);
                div.find('.options').append(`<li><input style="width:25px" type="text" name="reaction" value="${spell.reaction}" data-numberonly="true" /> ms reaction time</li>`);
            }

            if (spell.id == 900008) {
                div.find('.options').empty();
                div.find('.options').prepend(`<li>Open with ${spell.name}</li>`);
            }

            if (spell.id == 900006) {
                div.find('.options').empty();
                div.find('.options').prepend(`<li>Don't use rage until CbR procs.</li>`);
            }

            view.rotation.find('div:first').append(div);
        }

        view.rotation.children().eq(3).appendTo(view.rotation);
        view.rotation.children().eq(19).appendTo(view.rotation);
    },

    buildBuffs: function () {
        var view = this;
        view.buffs.empty();
        view.buffs.append('<label class="active">Buffs</label>');
        let storage = JSON.parse(localStorage[mode]);
        let level = parseInt(storage.level);
        let worldbuffs = '', consumes = '', other = '';
        for (let buff of buffs) {
            let min = parseInt(buff.minlevel || 0);
            let max = parseInt(buff.maxlevel || 60);
            if (level < min || level > max) {
                buff.active = false;
                continue;
            }
            let wh = buff.spellid ? 'spell' : 'item';
            let active = buff.active ? 'active' : '';
            let group = buff.group ? `data-group="${buff.group}"` : '';
            let disable = buff.disableSpell ? `data-disable-spell="${buff.disableSpell}"` : '';
            let html = `<div data-id="${buff.id}" class="icon ${active}" ${group} ${disable}>
                            <img src="/dist/img/${buff.iconname.toLowerCase()}.jpg " alt="${buff.name}">
                            <a href="https://classic.wowhead.com/${wh}=${buff.id}" class="wh-tooltip"></a>
                        </div>`;
            if (buff.worldbuff) worldbuffs += html;
            else if (buff.consume) consumes += html;
            else if (buff.other) other += html;
            else view.buffs.append(html);
        }
        view.buffs.append('<div class="label">Consumables</div>');
        view.buffs.append(consumes);
        view.buffs.append('<div class="label">World Buffs</div>');
        view.buffs.append(worldbuffs);
        view.buffs.append('<div class="label">Other</div>');
        view.buffs.append(other);
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
                div.html('<img src="/dist/img/' + talent.iconname.toLowerCase() + '.jpg" alt="' + talent.n + '" />');
                if (talent.c >= talent.m) div.addClass('maxed');
                div.append('<a href="https://classic.wowhead.com/spell=' + talent.s[talent.c == 0 ? 0 : talent.c - 1] + '" class="wh-tooltip"></a>');
                table.find('tr').eq(talent.y).children().eq(talent.x).append(div);
            }
            view.talents.append(table);
        }
    },

    buildRunes: function () {
        var view = this;
        if (typeof runes === "undefined") return;
        for (let type in runes) {
            for (let i in runes[type]) {
                let rune = runes[type][i];
                if (rune.enable && rune.selected) view.rotation.find('[data-id="' + rune.enable + '"]').removeClass('hidden');
                if (rune.enable && !rune.selected) view.rotation.find('[data-id="' + rune.enable + '"]').addClass('hidden');
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
