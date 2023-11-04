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
);

onmessage = (event) => {
    const params = event.data;
    updateGlobals(params.globals);
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
};

// console.log('sim-worker loaded');
