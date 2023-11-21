var SIM = SIM || {}

SIM.PROFILES = {

    init: function () {
        var view = this;
        view.variables();
        view.events();
        view.buildProfiles();
    },

    variables: function () {
        var view = this;
        view.body = $('body');
        view.section = view.body.find('section.profiles');
        view.container = view.section.find('.container');
        view.close = view.section.find('.btn-close');
        view.modal = view.body.find('.import-modal');
        view.textarea = view.modal.find('textarea');
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-profiles').removeClass('active');
            view.section.removeClass('active');
            view.body.addClass('sidebar-mobile-open');
        });

        view.container.on('click','.profile ul', function (e) {
            e.preventDefault();
            let p = $(this).parents('.profile');
            view.loadProfile(p);
            view.close.click();
        });

        view.container.on('click','.add-profile', function (e) {
            e.preventDefault();
            view.addProfile($(this).parent().prev().data('index') + 1);
        });

        view.container.on('click','.import-profile', function (e) {
            e.preventDefault();
            view.modal.addClass('open');
            view.textarea.focus();
        });

        view.container.on('click','.delete-profile', function (e) {
            e.preventDefault();
            e.stopPropagation();
            view.deleteProfile($(this).parents('.profile'));
        });

        view.container.on('click','.profile input', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass('edit');
        });

        view.container.on('keyup','.profile input', function (e) {
            if (e.key == "Enter") {
                $(this).removeClass('edit');
                let val = $(this).val();
                let profile = $(this).parents('.profile');
                let index = profile.data('index');
                let storage = JSON.parse(localStorage[mode + index])
                storage.profilename = val;
                localStorage[mode + index] = JSON.stringify(storage);
                if (profile.hasClass('active')) globalThis.profilename = val;
                $(this).blur();
                SIM.UI.updateSession();
            }
        });

        view.container.on('click','.edit-profilename', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).siblings('input').addClass('edit');
        });

        view.container.on('click','.export-profile', function (e) {
            e.preventDefault();
            e.stopPropagation();
            view.exportProfile($(this).parents('.profile'));
        });

        view.modal.find('.btn-close').click(function(e) {
            e.preventDefault();
            view.modal.removeClass('open');
        });

        view.textarea.on('input', function(e) {
            let val = $(this).val();
            if (val && val.length > 20) {
                let index = view.container.find('.profile').last().data('index') + 1;
                view.importProfile(val, index);
                view.modal.removeClass('open');
                $(this).val('');
            }
        });

    },

    deleteProfile(profile) {
        let index = profile.data('index');
        delete localStorage[mode + index];
        if (globalThis.profileid == index) globalThis.profileid = 0;
        this.buildProfiles();
        SIM.UI.addAlert(`Profile deleted`);
    },
 
    addProfile(index) {
        const view = this;
        let modei = mode + index;
        let oldmodei = mode + (globalThis.profileid || 0);

        if (typeof localStorage[modei] === 'undefined') {
            localStorage[modei] = localStorage[oldmodei];
            let storage = JSON.parse(localStorage[modei]);
            storage.profilename = "Profile " + (index + 1);
            localStorage[modei] = JSON.stringify(storage);
        }

        view.buildProfiles();
    },

    loadProfile(profile) {
        const view = this;
        var index = profile.data('index');
        let modei = mode + index;
        let oldmodei = mode + (globalThis.profileid || 0);
        globalThis.profileid = index;

        if (typeof localStorage[modei] === 'undefined') {
            localStorage[modei] = localStorage[oldmodei];
        }

        SIM.UI.loadSession();
        SIM.UI.updateSidebar();
        SIM.SETTINGS.buildSpells();
        SIM.SETTINGS.buildBuffs();
        SIM.SETTINGS.buildTalents();
        SIM.SETTINGS.buildRunes();
        view.body.find('nav > ul > li.active > p').click();

        let storage = JSON.parse(localStorage[modei]);
        SIM.UI.addAlert(`${storage.profilename} loaded`);
        profile.addClass('active');
        profile.siblings().removeClass('active');
    },

    buildProfiles() {
        const view = this;
        view.container.empty();

        let profileid = globalThis.profileid || 0;
        let i = 0;
        do {
            if (!localStorage[mode + i]) continue;
            let storage = JSON.parse(localStorage[mode + i]);
            let items = view.getItemsHTML(storage);
            let talents = view.getTalents(storage);
            let profile = $(`
                <div data-index="${i}" class="profile ${profileid == i ? 'active' : ''}">
                    <div class="title"><input name="profilename" type="text" value="${storage.profilename}" /><div class="edit-profilename">${svgPencil}</div></div>
                    <p>${storage.race} level ${storage.level}</p>
                    <p></p>
                    <p>${talents}</p>
                    <ul>${items}</ul>
                    <div class="export-profile" title="Export" ${i == 0 ? 'style="right: 20px"' : ''}>${svgExport}</div>
                    ${i > 0 ? `<div class="delete-profile" title="Delete">${svgThrash}</div>` : ''}
                </div>`);
            view.container.append(profile);
        } while (i++<40);

        view.container.append(`<div>
            <div class="add-profile">${svgAdd}<p>Add Profile</p></div>
            <div class="import-profile">${svgImport}<p>Import Profile</p></div>
            </div>`);
    },

    getItemsHTML(storage) {
        const view = this;
        let html = '';
        for(let type in storage.gear) {
            if (type == "twohand" || type == "mainhand" || type == "offhand") {
                for  (let item of storage.gear[type]) {
                    if (item.selected) 
                        html += view.getItemHTML(view.getItem(item.id));
                }
            }
        }
        for(let type in storage.gear) {
            if (type != "twohand" && type != "mainhand" && type != "offhand") {
                for  (let item of storage.gear[type]) {
                    if (item.selected) 
                        html += view.getItemHTML(view.getItem(item.id));
                }
            }
        }
        return html;
    },

    getItemHTML(item) {
        let icon = '';
        if (typeof runes !== 'undefined' && runes[item.slot]) {
            for (let rune of runes[item.slot]) {
                if (rune.selected) {
                    icon = `<img src="dist/img/${rune.iconname}.jpg">`
                }
            }
        }
        let html = `<li data-quality="${item.q}"><p>${item.name}</p> ${icon}</li>`;
        return html;
    },

    getItem(id) {
        for(let type in gear)
            for(let item of gear[type])
                if (item.id == id) return item;
    },

    getTalents(storage) {
        const view = this;
        let arms = storage.talents[0].t.reduce((p, a) => p + a, 0);
        let fury = storage.talents[1].t.reduce((p, a) => p + a, 0);
        let prot = storage.talents[2].t.reduce((p, a) => p + a, 0);
        return `${arms} / ${fury} / ${prot}`;
    },

    
    exportProfile: function(profile) {
        const view = this;

        let index = profile.data('index');
        let storage = JSON.parse(localStorage[mode + index]);
        let minified = {};


        for(let prop in storage) {
            if (typeof storage[prop] == 'string') minified[prop] = storage[prop];
        }
        minified.buffs = storage.buffs;
        minified.talents = storage.talents;
        minified.gear = {};
        for (let type in storage.gear) {
            for (let item of storage.gear[type])
                if (item.selected) minified.gear[type] = item.id;
        }
        minified.rotation = [];
        for (let spell of storage.rotation) {
            if (spell.active) {
                let obj = {};
                obj.id = spell.id;
                if (typeof spell.duration !== 'undefined') obj.duration = spell.duration;
                if (typeof spell.durationactive !== 'undefined') obj.durationactive = spell.durationactive;
                if (typeof spell.timetoend !== 'undefined') obj.timetoend = spell.timetoend;
                if (typeof spell.crusaders !== 'undefined') obj.crusaders = spell.crusaders;
                if (typeof spell.haste !== 'undefined') obj.haste = spell.haste;
                if (typeof spell.procblock !== 'undefined') obj.procblock = spell.procblock;
                if (typeof spell.rageblock !== 'undefined') obj.rageblock = spell.rageblock;
                if (typeof spell.rageblockactive !== 'undefined') obj.rageblockactive = spell.rageblockactive;
                if (typeof spell.executestacks !== 'undefined') obj.executestacks = spell.executestacks;
                if (typeof spell.executestacksactive !== 'undefined') obj.executestacksactive = spell.executestacksactive;
                if (typeof spell.minrage !== 'undefined') obj.minrage = spell.minrage;
                if (typeof spell.minrageactive !== 'undefined') obj.minrageactive = spell.minrageactive;
                if (typeof spell.maxrage !== 'undefined') obj.maxrage = spell.maxrage;
                if (typeof spell.maxrageactive !== 'undefined') obj.maxrageactive = spell.maxrageactive;
                if (typeof spell.maincd !== 'undefined') obj.maincd = spell.maincd;
                if (typeof spell.maincdactive !== 'undefined') obj.maincdactive = spell.maincdactive;
                if (typeof spell.priorityap !== 'undefined') obj.priorityap = spell.priorityap;
                if (typeof spell.priorityapactive !== 'undefined') obj.priorityapactive = spell.priorityapactive;
                if (typeof spell.flagellation !== 'undefined') obj.flagellation = spell.flagellation;
                if (typeof spell.consumedrage !== 'undefined') obj.consumedrage = spell.consumedrage;
                if (typeof spell.unqueue !== 'undefined') obj.unqueue = spell.unqueue;
                if (typeof spell.unqueueactive !== 'undefined') obj.unqueueactive = spell.unqueueactive;
                if (typeof spell.exmacro !== 'undefined') obj.exmacro = spell.exmacro;
                if (typeof spell.globals !== 'undefined') obj.globals = spell.globals;
                if (typeof spell.globalsactive !== 'undefined') obj.globalsactive = spell.globalsactive;
                minified.rotation.push(obj);
            }
        }
        minified.runes = {};
        for (let type in storage.runes) {
            for (let item of storage.runes[type])
                if (item.selected) minified.runes[type] = item.id;
        }
        minified.enchant = {};
        for (let type in storage.enchant) {
            for (let item of storage.enchant[type])
                if (item.selected) {
                    if (!minified.enchant[type]) minified.enchant[type] = [];
                    minified.enchant[type].push(item.id);
                }
        }

        let str = btoa(JSON.stringify(minified));
        navigator.clipboard.writeText(str);
        SIM.UI.addAlert('Profile copied to clipboard');
    },

    importProfile(str, index) {
        const view = this;
        try {
            let minified = str[0] == '{' ? JSON.parse(str) : JSON.parse(atob(str));
            let storage = JSON.parse(localStorage[mode + (globalThis.profileid || 0)]);


            for(let prop in minified) {
                if (typeof minified[prop] == 'string') storage[prop] = minified[prop];
            }
            storage.buffs = minified.buffs;
            storage.talents = minified.talents;

            for (let type in storage.gear) {
                for (let item of storage.gear[type])
                    if (item.id == minified.gear[type]) item.selected = true;
                    else delete item.selected;
            }
            for (let spell of storage.rotation) {
                let newspell = minified.rotation.filter(s => s.id == spell.id)[0];
                if (newspell) {
                    spell.active = true;
                    if (typeof newspell.duration !== 'undefined') spell.duration = newspell.duration;
                    if (typeof newspell.durationactive !== 'undefined') spell.durationactive = newspell.durationactive;
                    if (typeof newspell.timetoend !== 'undefined') spell.timetoend = newspell.timetoend;
                    if (typeof newspell.crusaders !== 'undefined') spell.crusaders = newspell.crusaders;
                    if (typeof newspell.haste !== 'undefined') spell.haste = newspell.haste;
                    if (typeof newspell.procblock !== 'undefined') spell.procblock = newspell.procblock;
                    if (typeof newspell.rageblock !== 'undefined') spell.rageblock = newspell.rageblock;
                    if (typeof newspell.rageblockactive !== 'undefined') spell.rageblockactive = newspell.rageblockactive;
                    if (typeof newspell.executestacks !== 'undefined') spell.executestacks = newspell.executestacks;
                    if (typeof newspell.executestacksactive !== 'undefined') spell.executestacksactive = newspell.executestacksactive;
                    if (typeof newspell.minrage !== 'undefined') spell.minrage = newspell.minrage;
                    if (typeof newspell.minrageactive !== 'undefined') spell.minrageactive = newspell.minrageactive;
                    if (typeof newspell.maxrage !== 'undefined') spell.maxrage = newspell.maxrage;
                    if (typeof newspell.maxrageactive !== 'undefined') spell.maxrageactive = newspell.maxrageactive;
                    if (typeof newspell.maincd !== 'undefined') spell.maincd = newspell.maincd;
                    if (typeof newspell.maincdactive !== 'undefined') spell.maincdactive = newspell.maincdactive;
                    if (typeof newspell.priorityap !== 'undefined') spell.priorityap = newspell.priorityap;
                    if (typeof newspell.priorityapactive !== 'undefined') spell.priorityapactive = newspell.priorityapactive;
                    if (typeof newspell.flagellation !== 'undefined') spell.flagellation = newspell.flagellation;
                    if (typeof newspell.consumedrage !== 'undefined') spell.consumedrage = newspell.consumedrage;
                    if (typeof newspell.unqueue !== 'undefined') spell.unqueue = newspell.unqueue;
                    if (typeof newspell.unqueueactive !== 'undefined') spell.unqueueactive = newspell.unqueueactive;
                    if (typeof newspell.exmacro !== 'undefined') spell.exmacro = newspell.exmacro;
                    if (typeof newspell.globals !== 'undefined') spell.globals = newspell.globals;
                    if (typeof newspell.globalsactive !== 'undefined') spell.globalsactive = newspell.globalsactive;
                }
                else {
                    spell.active = false;
                }
            }
            for (let type in storage.runes) {
                for (let item of storage.runes[type])
                    if (item.id == minified.runes[type]) item.selected = true;
                    else delete item.selected;
            }

            for (let type in storage.enchant) {
                for (let item of storage.enchant[type]) {
                    if (minified.enchant[type] && minified.enchant[type].includes(item.id))
                        item.selected = true;
                    else
                        delete item.selected;
                }
            }

            let modei = mode + index;
            localStorage[modei] = JSON.stringify(storage);
            view.buildProfiles();
            SIM.UI.addAlert(storage.profilename + ' imported');

        } catch (e) {
            SIM.UI.addAlert('Invalid profile');
        }
    }

};

const svgImport = '<svg width="24"height="24"viewBox="0 0 24 24"fill="none"xmlns="http://www.w3.org/2000/svg"><path  d="M5 9.98193V19.9819H19V9.98193H15V7.98193H21V21.9819H3V7.98193H9V9.98193H5Z" fill="currentColor"/><path  d="M13.0001 2H11.0001V14.0531L8.46451 11.5175L7.05029 12.9317L12 17.8815L16.9498 12.9317L15.5356 11.5175L13.0001 14.053V2Z" fill="currentColor"/></svg>';
const svgExport = '<svg width="24"height="24"viewBox="0 0 24 24"fill="none"xmlns="http://www.w3.org/2000/svg"><path  d="M16.9498 5.96781L15.5356 7.38203L13 4.84646V17.0421H11V4.84653L8.46451 7.38203L7.05029 5.96781L12 1.01807L16.9498 5.96781Z"  fill="currentColor"/><path  d="M5 20.9819V10.9819H9V8.98193H3V22.9819H21V8.98193H15V10.9819H19V20.9819H5Z"  fill="currentColor"/></svg>';
const svgPencil = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>';
const svgThrash = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/></svg>';
const svgAdd = '<svg width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  xmlns="http://www.w3.org/2000/svg">  <path    d="M12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13V5C13 4.44772 12.5523 4 12 4Z" fill="currentColor"  /></svg>';