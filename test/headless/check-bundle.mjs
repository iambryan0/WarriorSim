// Runs one fixture through the MINIFIED Vite build (dist/assets/sod-*.js)
// and compares the aggregate result against its golden. The main parity gate
// (check.mjs) exercises unminified sources, so it cannot catch
// minification-only breakage — most importantly the engine's reliance on
// constructor.name for default aura/spell display names (guarded by
// keep_classnames in vite.config.js). Run `npm run build` first:
//
//   node test/headless/check-bundle.mjs [--fixture test/fixtures/thbwl.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './sandbox.mjs';

const i = process.argv.indexOf('--fixture');
const fixturePath = i > -1 ? process.argv[i + 1] : path.join(ROOT, 'test/fixtures/thbwl.json');

const assetsDir = path.join(ROOT, 'dist/assets');
const chunk = fs.existsSync(assetsDir)
    && fs.readdirSync(assetsDir).find((f) => f.startsWith('sod-') && f.endsWith('.js'));
if (!chunk) {
    console.error('no dist/assets/sod-*.js — run `npm run build` first');
    process.exit(2);
}

// Vite's modulepreload polyfill (bundled into the entry chunk) probes the
// DOM at import time; this stub satisfies it and nothing else — the engine
// itself never touches document headless.
globalThis.document ??= {
    createElement: () => ({ relList: { supports: () => true } }),
};

// The bundle's interim globalThis shims (Player, Simulation, updateGlobals,
// RNG, ...) are the access path; once the shims are removed this check should
// switch to importing the built module's exports.
await import(pathToFileURL(path.join(assetsDir, chunk)).href);

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const golden = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'test/golden', path.basename(fixturePath)), 'utf8'));

globalThis.RNG.seed(fixture.seed ?? 42);
globalThis.updateGlobals(fixture.globals);
const player = new globalThis.Player(undefined, undefined, undefined, fixture.playerConfig);
let report = null;
const sim = new globalThis.Simulation(player, (r) => { report = r; }, null, fixture.simConfig);
sim.startSync();

const meandps = report.totaldmg / report.totalduration;
const flurry = player.auras.flurry && player.auras.flurry.name;
let failed = 0;
if (meandps !== golden.meandps) {
    console.error(`FAIL meandps: bundle ${meandps} != golden ${golden.meandps}`);
    failed = 1;
}
if (flurry !== 'Flurry') {
    console.error(`FAIL constructor.name survived minification badly: flurry aura named ${JSON.stringify(flurry)}`);
    failed = 1;
}
if (!failed) console.error(`ok   bundle ${path.basename(fixturePath)} (meandps ${meandps.toFixed(2)}, aura names intact)`);
process.exit(failed);
