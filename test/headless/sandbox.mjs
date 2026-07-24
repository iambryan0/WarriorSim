// Loads the engine sources into a Node vm context, mirroring the script list
// and order of js/sim-worker.js. Randomness is made deterministic through the
// engine's own injection point: RNG.seed() (js/rng.js), which swaps
// RNG.random from its Math.random default to seeded mulberry32.
//
// During the ESM migration the engine is a mix of classic scripts and ES
// modules. Classic files run via vm.runInContext (script semantics: top-level
// class/let/const become the context's shared global lexical bindings, exactly
// like ordered <script> tags). Converted files (listed in ESM below) run as
// real modules in the SAME context via vm.SourceTextModule, so both worlds
// share one realm — a module's globalThis shims are visible to classic files
// and vice versa. vm.SourceTextModule needs node --experimental-vm-modules;
// check.mjs passes the flag when spawning, add it yourself for direct
// run.mjs/capture-fixtures.mjs invocations (only needed once ESM is
// non-empty).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// Repo-relative paths of files already converted to ES modules.
export const ESM = new Set([
    'js/rng.js',
    'js/data/buffs.js',
    'js/data/enchants.js',
    'js/data/gear.js',
    'js/data/gear_sod.js',
    'js/data/levelstats.js',
    'js/data/mode.js',
    'js/data/presets.js',
    'js/data/runes.js',
    'js/data/session.js',
    'js/data/session_sod.js',
    'js/data/spells.js',
    'js/data/talents.js',
    'js/classes/player.js',
    'js/classes/simulation.js',
    'js/classes/spell.js',
    'js/classes/weapon.js',
    'js/globals.js',
]);

// trace: optional array that collects console.log first-arguments (the
// engine's /* start-log */ event log when player config has logging: true).
export async function createEngineContext({ sod = true, trace = null, extraScripts = [] } = {}) {
    const sandbox = {
        console: {
            log: (...args) => { if (trace) trace.push(String(args[0])); },
            warn: () => {},
            error: (...args) => { throw new Error('engine console.error: ' + args.join(' ')); },
        },
    };
    const ctx = vm.createContext(sandbox);

    if (ESM.size && typeof vm.SourceTextModule !== 'function') {
        throw new Error('ES-module engine files need node --experimental-vm-modules');
    }
    const moduleCache = new Map();
    function loadModule(absPath) {
        const key = pathToFileURL(absPath).href;
        let mod = moduleCache.get(key);
        if (!mod) {
            mod = new vm.SourceTextModule(fs.readFileSync(absPath, 'utf8'), {
                context: ctx,
                identifier: key,
                initializeImportMeta: (meta) => { meta.url = key; },
                importModuleDynamically: (specifier, referencing) => evalModule(resolve(specifier, referencing)),
            });
            moduleCache.set(key, mod);
        }
        return mod;
    }
    const resolve = (specifier, referencing) =>
        path.resolve(path.dirname(fileURLToPath(referencing.identifier)), specifier);
    const linker = (specifier, referencing) => loadModule(resolve(specifier, referencing));
    async function evalModule(absPath) {
        const mod = loadModule(absPath);
        if (mod.status === 'unlinked') await mod.link(linker);
        if (mod.status === 'linked') await mod.evaluate();
        return mod;
    }

    const scripts = [...ENGINE_SCRIPTS, ...(sod ? SOD_DATA : CLASSIC_DATA), ...extraScripts];
    for (const rel of scripts) {
        const abs = path.join(ROOT, rel);
        if (ESM.has(rel)) await evalModule(abs);
        else vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: rel });
    }

    // Synthetic entry mirroring main-sod.js / main-classic.js: install the
    // mode-specific tables the engine imports from js/data/mode.js.
    const installSrc = sod
        ? "import { gear } from './data/gear_sod.js';\n" +
          "import { runes } from './data/runes.js';\n" +
          "import { installModeData } from './data/mode.js';\n" +
          'installModeData({ gear, runes });\n'
        : "import { gear } from './data/gear.js';\n" +
          "import { installModeData } from './data/mode.js';\n" +
          'installModeData({ gear });\n';
    const entry = new vm.SourceTextModule(installSrc, {
        context: ctx,
        identifier: pathToFileURL(path.join(ROOT, 'js/__install-mode__.mjs')).href,
        importModuleDynamically: (specifier, referencing) => evalModule(resolve(specifier, referencing)),
    });
    await entry.link(linker);
    await entry.evaluate();
    return ctx;
}

export function seedContext(ctx, seed) {
    vm.runInContext(`RNG.seed(${seed >>> 0});`, ctx);
}
