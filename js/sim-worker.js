importScripts(
    './rng.js',
    './data/buffs.js',
    './data/enchants.js',
    './data/levelstats.js',
    './data/spells.js',
    './data/talents.js',
    './classes/player.js',
    './classes/simulation.js',
    './classes/spell.js',
    './classes/weapon.js',
    './globals.js',
);

onmessage = (event) => {
    const params = event.data;
    if (params.globals.sod) importScripts('./data/gear_sod.js','./data/runes.js');
    else importScripts('./data/gear.js');
    updateGlobals(params.globals);
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

