function getGlobalsDelta() {
    const _gear = {};
    for (const type in gear) {
        _gear[type] = gear[type].map((item) => {
            return {
                id: item.id,
                dps: item.dps,
                selected: item.selected,
                hidden: item.hidden,
            }
        });
    }
    const _enchant = {};
    for (const type in enchant) {
        _enchant[type] = enchant[type].map((item) => {
            return {
                id: item.id,
                dps: item.dps,
                selected: item.selected,
                hidden: item.hidden,
            }
        });
    }
    const _runes = {};
    if (typeof runes !== "undefined") {
        for (const type in runes) {
            _runes[type] = runes[type].map((item) => {
                return {
                    id: item.id,
                    selected: item.selected,
                    hidden: item.hidden,
                }
            });
        }
    }
    return {
        talents: talents.map((tree) => {
            return {
                t: tree.t.map((talent) => talent.c),
            };
        }),
        buffs: buffs
            .filter((buff) => buff.active)
            .map((buff) => buff.id),
        rotation: spells,
        gear: _gear,
        enchant: _enchant,
        runes: _runes,
        sod: window.location.href.indexOf("classic.html") == -1
    }
}

function updateGlobals(params) {
    for (let tree in params.talents)
        for (let talent in params.talents[tree].t)
            talents[tree].t[talent].c = params.talents[tree].t[talent];

    for (let j of buffs) j.active = false;
    for (let i of params.buffs)
        for (let j of buffs)
            if (i == j.id) j.active = true;

    for (let i of params.rotation)
        for (let j of spells)
            if (i.id == j.id)
                for (let prop in i)
                    if (prop != 'minlevel' && prop != 'maxlevel' && prop != 'iconname')
                        j[prop] = i[prop];

    for (let type in gear)
        for (let j of gear[type])
            if (j.selected) j.selected = false;

    for (let type in params.gear)
        for (let i of params.gear[type])
            if (gear[type])
                for (let j of gear[type]) {
                    if (i.id == j.id) {
                        j.dps = i.dps;
                        j.selected = i.selected;
                        j.hidden = i.hidden;
                    }
                }

    for (let type in enchant)
        for (let j of enchant[type])
            if (j.selected) j.selected = false;

    for (let type in params.enchant)
        for (let i of params.enchant[type])
            for (let j of enchant[type])
                if (i.id == j.id) {
                    j.dps = i.dps;
                    j.selected = i.selected;
                    j.hidden = i.hidden;
                }

    if (typeof runes !== 'undefined') {
        for (let type in runes)
            for (let j of runes[type])
                if (j.selected) j.selected = false;
    }
    for (let type in params.runes)
        for (let i of params.runes[type])
            for (let j of runes[type])
                if (i.id == j.id) {
                    j.selected = i.selected;
                    j.hidden = i.hidden;
                }

    for (let type in params.resistances) {
        if (params.resistances[type]) {
            $('.resistances-list.hidden').removeClass('hidden');
            $(".js-toggle[data-id='resistances-list']").addClass('active');
            $(".resistances[data-id='"+type+"-resist']").click()
        }
    }
}
