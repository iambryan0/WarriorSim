// Loads the engine sources into a Node vm context, mirroring the script list
// and order of js/sim-worker.js. Randomness is made deterministic through the
// engine's own injection point: RNG.seed() (js/rng.js), which swaps
// RNG.random from its Math.random default to seeded mulberry32.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Same order as importScripts() in js/sim-worker.js.
export const ENGINE_SCRIPTS = [
    'js/rng.js',
    'js/data/buffs.js',
    'js/data/enchants.js',
    'js/data/levelstats.js',
    'js/data/spells.js',
    'js/data/talents.js',
    'js/classes/player.js',
    'js/classes/simulation.js',
    'js/classes/spell.js',
    'js/classes/weapon.js',
    'js/globals.js',
];
export const SOD_DATA = ['js/data/gear_sod.js', 'js/data/runes.js'];
export const CLASSIC_DATA = ['js/data/gear.js'];

// trace: optional array that collects console.log first-arguments (the
// engine's /* start-log */ event log when player config has logging: true).
export function createEngineContext({ sod = true, trace = null, extraScripts = [] } = {}) {
    const sandbox = {
        console: {
            log: (...args) => { if (trace) trace.push(String(args[0])); },
            warn: () => {},
            error: (...args) => { throw new Error('engine console.error: ' + args.join(' ')); },
        },
    };
    const ctx = vm.createContext(sandbox);
    const scripts = [...ENGINE_SCRIPTS, ...(sod ? SOD_DATA : CLASSIC_DATA), ...extraScripts];
    for (const rel of scripts) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
    }
    return ctx;
}

export function seedContext(ctx, seed) {
    vm.runInContext(`RNG.seed(${seed >>> 0});`, ctx);
}
