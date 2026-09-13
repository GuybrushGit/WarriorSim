'use strict';

const configuredFixtures = require('./fixtures.json');
const dualWield = configuredFixtures.find(value => value.name === 'classic-dw-fury');
const adjacentCleave = configuredFixtures.find(value => value.name === 'classic-adjacent-cleave');

function copy(value) {
    return JSON.parse(JSON.stringify(value));
}

function bounded(base, name, seed, iterations = 6) {
    const fixture = copy(base);
    fixture.name = name;
    fixture.sim = {
        ...fixture.sim,
        timesecsmin: 16,
        timesecsmax: 16,
        iterations,
        seed,
    };
    return fixture;
}

function bloodrage(name, seed, schedule, mutatePlayer) {
    const fixture = bounded(dualWield, name, seed);
    fixture.rotation = {
        2687: {
            active: true,
            timetostartactive: false,
            timetoendactive: false,
            ...schedule,
        },
    };
    fixture.mutatePlayer = mutatePlayer;
    return fixture;
}

const bloodrageCases = [
    bloodrage('classic-bloodrage-start-schedule', 0xB1000001, {
        timetostartactive: true,
        timetostart: 3,
    }),
    bloodrage('classic-bloodrage-end-schedule', 0xB1000002, {
        timetoendactive: true,
        timetoend: 12,
    }),
    bloodrage('classic-bloodrage-explicit-step', 0xB1000003, {}, player => {
        player.spells.bloodrage.usestep = 4500;
    }),
    bloodrage('classic-bloodrage-unscheduled', 0xB1000004, {}, player => {
        delete player.spells.bloodrage.usestep;
    }),
];

function stanceCase(name, seed, setup) {
    const fixture = bounded(dualWield, name, seed, 8);
    fixture.sim.startrage = 100;
    fixture.buffsRemove = [2458];
    fixture.buffsAdd = [2457];
    fixture.rotation = {
        11567: {active: false},
        25286: {active: false},
        20662: {active: false},
        23894: {active: false},
        1680: {active: true, priority: 10, maincdactive: false},
    };
    fixture.mutatePlayer = (player, engine) => {
        player.talents.rageretained = 100;
        const unstoppable = player.spells.unstoppablemight;
        unstoppable.switchstart = false;
        unstoppable.switchdefault = true;
        unstoppable.secondarystance = 'zerk';
        setup(player, engine);
        player.update();
    };
    return fixture;
}

const stanceCases = [
    stanceCase('classic-unstoppable-without-echoes', 0x57A00001, () => {}),
    stanceCase('classic-unstoppable-with-echoes', 0x57A00001, (player, engine) => {
        player.auras.echoesbattle = engine.createAura(player, 'EchoesBattle');
        player.auras.echoeszerk = engine.createAura(player, 'EchoesZerk');
    }),
    stanceCase('classic-stance-switch-without-unstoppable', 0x57A00001, (player, engine) => {
        delete player.spells.unstoppablemight;
        player.preporder = player.preporder.filter(value => value.classname !== 'UnstoppableMight');
        player.auras.echoeszerk = engine.createAura(player, 'EchoesZerk');
    }),
];

function aliasCase(key, seed) {
    const fixture = bounded(dualWield, `classic-${key}-supported-kind-alias`, seed, 3);
    fixture.mutatePlayer = (player, engine) => {
        const alias = engine.createSpell(player, 'GrilekFury');
        alias.usestep = 0;
        player.spells[key] = alias;
    };
    return fixture;
}

const aliasCases = [
    aliasCase('bloodrage', 0xA11A5001),
    aliasCase('unstoppablemight', 0xA11A5002),
    aliasCase('stanceswitch', 0xA11A5003),
];

const orderedProcs = bounded(adjacentCleave, 'classic-ordered-multi-procs', 0xC01DF00D, 12);
orderedProcs.mutatePlayer = (player, engine) => {
    const weaponFlip = engine.createAura(player, 'CoinFlip');
    const trinketFlip = engine.createAura(player, 'CoinFlip');
    const attackFlip = engine.createAura(player, 'CoinFlip');
    player.auras.procweaponflip = weaponFlip;
    player.auras.proctrinketflip = trinketFlip;
    player.auras.procattackflip = attackFlip;

    // The zero-chance slots are intentional: JavaScript still consumes their
    // trigger rolls before the later random procs in this chain.
    player.mh.proc1 = {chance: 10000, magicdmg: 11, spell: weaponFlip};
    player.mh.proc2 = {chance: 0, magicdmg: 13};
    player.oh.proc1 = {chance: 0, extra: 1};
    player.oh.proc2 = {chance: 10000, magicdmg: 5};
    player.trinketproc1 = {chance: 6500, magicdmg: 17, spell: trinketFlip};
    player.trinketproc2 = {chance: 3500, extra: 1, cooldown: 2300, usestep: 0};
    player.attackproc1 = {chance: 10000, magicdmg: 19, spell: attackFlip};
    player.attackproc2 = {chance: 2600, extra: 1};
    player.base.hit -= 10;
    player.update();
};

const spicyDynamicProcs = bounded(dualWield, 'classic-spicy-dynamic-procs', 0x5A1C0001, 16);
spicyDynamicProcs.mutatePlayer = (player, engine) => {
    const spicy = engine.createAura(player, 'Spicy');
    player.auras.spicy = spicy;
    player.mh.proc1 = {chance: 10000, spell: spicy};
    delete player.mh.proc2;
    delete player.attackproc1;
    delete player.attackproc2;
};


module.exports = {
    aliasCases,
    bloodrageCases,
    orderedProcs,
    spicyDynamicProcs,
    stanceCases,
};
