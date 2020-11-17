importScripts(
    './data/buffs.min.js',
    './data/gear.min.js',
    './data/races.min.js',
    './data/spells.min.js',
    './data/talents.min.js',
    './classes/player.min.js',
    './classes/simulation.min.js',
    './classes/spell.min.js',
    './classes/weapon.min.js',
    './globals.min.js',
    './WarriorSim.min.js',
);

onmessage = (event) => {
    const params = event.data;
    updateGlobals(params.globals);

    const wasm = true ? fetch('./WarriorSim.wasm').then(r => r.arrayBuffer()).then(binary => WarriorSim({ wasmBinary: binary }).ready) : Promise.reject();

    wasm.then(module => {
        const itemSlots = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist', 'hands',
          'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2', 'ranged',
          'mainhand', 'offhand', 'twohand', 'custom'];
        const races = ['Human', 'Dwarf', 'Gnome', 'Night Elf', 'Orc', 'Tauren', 'Troll', 'Undead'];

        const rng = [...Array(8)].map(() => Math.floor(Math.random() * 65536));
        module._initRandom(...rng);

        for (let id of params.globals.buffs) {
            module._enableBuff(id, 1);
        }
        for (let slot in params.globals.enchant) {
            const slotId = itemSlots.indexOf(slot);
            for (let item of params.globals.enchant[slot]) {
                if (item.selected) {
                    module._enableEnchant(slotId, item.id, 1);
                }
            }
        }
        for (let slot in params.globals.gear) {
            const slotId = itemSlots.indexOf(slot);
            for (let item of params.globals.gear[slot]) {
                if (item.selected) {
                    module._enableItem(slotId, item.id, 1);
                }
            }
        }

        function spellOptions(index, ...fields) {
            const opt = params.globals.rotation[index];
            const ptr = module._spellOptions(opt.id) >> 2;
            module.HEAP32[ptr] = opt.active ? 1 : 0;
            fields.forEach((f, i) => module.HEAP32[ptr + i + 1] = opt[f]);
        }
        spellOptions(0, "minrage", "reaction"); // Bloodthirst
        spellOptions(1, "minrage", "reaction"); // Mortal Strike
        spellOptions(2, "minrage", "maincd", "unqueue", "unqueuetimer", "reaction"); // Heroic Strike
        spellOptions(4, "priorityap", "reaction"); // Execute
        spellOptions(5, "minrage", "maincd", "reaction"); // Whirlwind
        spellOptions(6, "timetoend", "crusaders", "reaction"); // Death Wish
        spellOptions(7, "timetoend", "reaction"); // Recklessness
        spellOptions(9, "maxrage", "maincd", "reaction"); // Overpower
        spellOptions(10, "timetoend", "haste", "reaction"); // Berserking
        spellOptions(11, "timetoend", "reaction"); // Blood Fury
        spellOptions(12, "reaction"); // Bloodrage
        spellOptions(13, "timetoend", "crusaders", "reaction"); // Mighty Rage Potion
        spellOptions(16, "globals", "reaction"); // Sunder Armor
        spellOptions(18, "minrage", "reaction"); // Hamstring
        spellOptions(19, "minrage", "unqueue", "unqueuetimer", "reaction"); // Heroic Strike (Execute Phase)

        const configPtr = module._allocConfig();
        const cfg = configPtr >> 2;
        module.HEAP32[cfg + 0] = params.player[0] != null ? params.player[0] : -1;
        module.HEAP32[cfg + 1] = params.player[1] != null ? (typeof params.player[1] === 'string' ? itemSlots.indexOf(params.player[1]) : params.player[1]) : -1;
        module.HEAP32[cfg + 2] = params.player[2] != null ? params.player[2] : -1;
        module.HEAP32[cfg + 3] = races.indexOf(params.player[3].race);
        module.HEAP32[cfg + 4] = params.player[3].aqbooks ? 1 : 0;
        module.HEAP32[cfg + 5] = params.player[3].weaponrng ? 1 : 0;
        module.HEAP32[cfg + 6] = params.player[3].spelldamage;
        module.HEAP32[cfg + 7] = params.player[3].target.level;
        module.HEAP32[cfg + 8] = params.player[3].target.basearmor;
        module.HEAP32[cfg + 9] = params.player[3].target.armor;
        module.HEAP32[cfg + 10] = params.player[3].target.defense;
        module.HEAP32[cfg + 11] = params.player[3].target.binaryresist;
        module.HEAPF64[(cfg + 12) >> 1] = params.player[3].target.mitigation;
        module.HEAP32[cfg + 14] = params.sim.timesecsmin;
        module.HEAP32[cfg + 15] = params.sim.timesecsmax;
        module.HEAP32[cfg + 16] = params.sim.executeperc;
        module.HEAP32[cfg + 17] = params.sim.startrage;
        module.HEAP32[cfg + 18] = params.sim.iterations;

        const talentsPtr = module._allocTalents();
        for (let tree of talents) {
            for (let talent of tree.t) {
                if (talent.c) {
                    module._setTalent(talentsPtr, talent.i, talent.c);
                }
            }
        }

        const simPtr = module._allocSimulation(configPtr, talentsPtr);
        module._runSimulation(simPtr);
        module._reportSimulation(simPtr, params.fullReport ? 1 : 0);
        module._freeSimulation(simPtr);
        module._freeTalents(talentsPtr);
        module._freeConfig(configPtr);
    }, err => {
        console.error(err);
        // console.log('starting sim-worker', params);
        const player = new Player(...params.player);
        const sim = new Simulation(player, (report) => {
            // Finished
            if (params.fullReport) {
                report.player = player.serializeStats();
                report.spread = sim.spread;
            }
            postMessage([TYPE.FINISHED, report]);
        }, (iteration, report) => {
            // Update
            postMessage([TYPE.UPDATE, iteration, report]);
        }, params.sim);
        sim.startSync();
    }).catch(error => {
        postMessage([TYPE.ERROR, error]);
    });
};

// console.log('sim-worker loaded');
