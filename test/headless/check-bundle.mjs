// Runs one fixture through the MINIFIED Vite build by driving the built
// worker chunk (dist/assets/sim-worker-*.js) through its real message
// protocol, and compares aggregates against the golden. The main parity gate
// (check.mjs) exercises unminified sources, so it cannot catch
// minification-only breakage — most importantly the engine's reliance on
// constructor.name for default aura/spell display names (guarded by rolldown
// output.keepNames in vite.config.js). Run `npm run build` first:
//
//   node test/headless/check-bundle.mjs [--fixture test/fixtures/thbwl.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './sandbox.mjs';

const i = process.argv.indexOf('--fixture');
const fixturePath = i > -1 ? process.argv[i + 1] : path.join(ROOT, 'test/fixtures/thbwl.json');

const assetsDir = path.join(ROOT, 'dist/assets');
const chunk =
    fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).find((f) => f.startsWith('sim-worker') && f.endsWith('.js'));
if (!chunk) {
    console.error('no dist/assets/sim-worker*.js — run `npm run build` first');
    process.exit(2);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/golden', path.basename(fixturePath)), 'utf8'));

// Minimal WorkerGlobalScope: the chunk assigns the global `onmessage` handler
// (legal in strict module code only because the property already exists) and
// reports through postMessage.
const messages = [];
globalThis.onmessage = null;
globalThis.postMessage = (msg) => messages.push(msg);
const engineLog = () => {};
globalThis.console = new Proxy(console, { get: (t, p) => (p === 'log' ? engineLog : t[p]) });

await import(pathToFileURL(path.join(assetsDir, chunk)).href);
if (typeof globalThis.onmessage !== 'function') {
    console.error('worker chunk did not install an onmessage handler');
    process.exit(1);
}

// The worker protocol: seed makes the run deterministic (same path the
// Phase 3 Rust/WASM validation will use); playerConfig/simConfig/globals are
// exactly what SimulationWorker sends.
await globalThis.onmessage({
    data: {
        seed: fixture.seed ?? 42,
        globals: fixture.globals,
        player: [undefined, undefined, undefined, fixture.playerConfig],
        sim: fixture.simConfig,
        fullReport: true,
    },
});

const finished = messages.find((m) => m[0] === 1); // TYPE.FINISHED
if (!finished) {
    console.error('FAIL worker never posted TYPE.FINISHED');
    process.exit(1);
}
const report = finished[1];
const meandps = report.totaldmg / report.totalduration;
const flurry = report.player.auras.flurry && report.player.auras.flurry.name;
let failed = 0;
if (meandps !== golden.meandps) {
    console.error(`FAIL meandps: bundle ${meandps} != golden ${golden.meandps}`);
    failed = 1;
}
if (flurry !== 'Flurry') {
    console.error(`FAIL constructor.name mangled by minification: flurry aura named ${JSON.stringify(flurry)}`);
    failed = 1;
}
if (!failed)
    console.error(
        `ok   bundle ${path.basename(fixturePath)} via worker protocol (meandps ${meandps.toFixed(2)}, names intact)`,
    );
process.exit(failed);
