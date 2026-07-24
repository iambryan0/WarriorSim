// Loads the (fully ES-module) engine by importing it natively, the same
// modules the pages and the worker use. Randomness is made deterministic
// through the engine's own injection point: RNG.seed() (js/rng.js), which
// swaps RNG.random from its Math.random default to seeded mulberry32.
//
// One engine per process — module state (data tables, mode installation) is
// process-wide, so loadEngine() may be called once. Isolation between
// fixtures comes from process boundaries (check.mjs spawns run.mjs per run).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The host's console, for harness output; globalThis.console is replaced by
// loadEngine() to capture the engine's event log.
export const hostConsole = console;

let loaded = false;

// trace: optional array that collects console.log first-arguments (the
// engine's /* start-log */ event log when player config has logging: true).
// Returns the engine surface the drivers need.
export async function loadEngine({ sod = true, trace = null } = {}) {
    if (loaded) throw new Error('engine already loaded in this process');
    loaded = true;
    globalThis.console = {
        log: (...args) => { if (trace) trace.push(String(args[0])); },
        warn: () => {},
        error: (...args) => { throw new Error('engine console.error: ' + args.join(' ')); },
    };

    const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
    const [{ RNG }, { updateGlobals }, { Player }, { Simulation }, { installModeData }, { spells }] =
        await Promise.all([
            imp('js/rng.js'),
            imp('js/globals.js'),
            imp('js/classes/player.js'),
            imp('js/classes/simulation.js'),
            imp('js/data/mode.js'),
            imp('js/data/spells.js'),
        ]);

    let session;
    if (sod) {
        const [{ gear }, { runes }, sessionMod] = await Promise.all(
            ['js/data/gear_sod.js', 'js/data/runes.js', 'js/data/session_sod.js'].map(imp));
        session = sessionMod.session;
        installModeData({ mode: 'sod', gear, runes, session });
    } else {
        const [{ gear }, sessionMod] = await Promise.all(
            ['js/data/gear.js', 'js/data/session.js'].map(imp));
        session = sessionMod.session;
        installModeData({ mode: 'classic', gear, session });
    }

    return { RNG, updateGlobals, Player, Simulation, session, spells };
}
