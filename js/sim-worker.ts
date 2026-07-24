// Module worker: runs the Monte Carlo simulation off the main thread.
// Spawned by SimulationWorker (js/classes/simulation.js) with
// { type: 'module' }. The mode-specific gear tables are loaded on demand from
// the first message, mirroring the old conditional importScripts.
import { RNG } from './rng.ts';
import { Player } from './classes/player.ts';
import { Simulation, TYPE } from './classes/simulation.ts';
import { updateGlobals } from './globals.ts';
import { installModeData } from './data/mode.ts';

onmessage = async (event) => {
    const params = event.data;
    // Deterministic runs (bundle parity checks now, Rust/WASM validation in
    // Phase 3) can pass a seed through the normal message protocol. The UI
    // never sets it, so production behavior is unchanged.
    if (params.seed !== undefined) RNG.seed(params.seed);
    if (params.globals.sod) {
        const [{ gear }, { runes }] = await Promise.all([
            import('./data/gear_sod.ts'),
            import('./data/runes.ts'),
        ]);
        installModeData({ gear, runes });
    } else {
        const { gear } = await import('./data/gear.ts');
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
