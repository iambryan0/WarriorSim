// Module worker: runs the Monte Carlo simulation off the main thread.
// Spawned by SimulationWorker (js/classes/simulation.js) with
// { type: 'module' }. The mode-specific gear tables are loaded on demand from
// the first message, mirroring the old conditional importScripts.
import { RNG } from './rng.js';
import { Player } from './classes/player.js';
import { Simulation, TYPE } from './classes/simulation.js';
import { updateGlobals } from './globals.js';
import { installModeData } from './data/mode.js';

onmessage = async (event) => {
    const params = event.data;
    // Deterministic runs (bundle parity checks now, Rust/WASM validation in
    // Phase 3) can pass a seed through the normal message protocol. The UI
    // never sets it, so production behavior is unchanged.
    if (params.seed !== undefined) RNG.seed(params.seed);
    if (params.globals.sod) {
        const [{ gear }, { runes }] = await Promise.all([
            import('./data/gear_sod.js'),
            import('./data/runes.js'),
        ]);
        installModeData({ gear, runes });
    } else {
        const { gear } = await import('./data/gear.js');
        installModeData({ gear });
    }
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
