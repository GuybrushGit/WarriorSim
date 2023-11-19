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
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-settings').removeClass('active');
            view.section.removeClass('active');
            view.body.addClass('sidebar-mobile-open');
        });



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
            let talents = "14 / 3 / 0";
            let profile = $(`
                <div class="profile ${profileid == i ? 'active' : ''}">
                    <div class="title">${storage.profilename}</div>
                    <p>${storage.race} level ${storage.level}</p>
                    <p></p>
                    <p>${talents}</p>
                    <ul>${items}</ul>
                </div>`);
            view.container.append(profile);
            console.log(storage);
        } while (i++<40)
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
        if (runes[item.slot]) {
            for (let rune of runes[item.slot]) {
                if (rune.selected) {
                    icon = `<img src="dist/img/${rune.iconname}.jpg">`
                }
            }
        }
        let html = `<li data-quality="${item.q}"><p>${item.name}</p> ${icon}</li>`;
        if (item.slot == "twohand") html += '<li></li>';
        return html;
    },
    

    getItem(id) {
        for(let type in gear)
            for(let item of gear[type])
                if (item.id == id) return item;
    }

};
