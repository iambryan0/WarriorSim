// Headless parity runner: executes one fixture through the engine exactly
// the way js/sim-worker.js does (updateGlobals -> new Player -> new
// Simulation -> startSync) and prints a deterministic JSON report.
//
//   node test/headless/run.mjs --fixture test/fixtures/thbwl.json [--seed 42]
//     [--out test/golden/thbwl.json] [--trace 400]
//
// The seed defaults to the fixture's embedded seed. starttime/endtime are
// wall-clock and deliberately excluded from the output.
import fs from 'node:fs';
import { loadEngine, hostConsole } from './sandbox.mjs';

function arg(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i > -1 ? process.argv[i + 1] : fallback;
}

const fixturePath = arg('fixture');
if (!fixturePath) {
    hostConsole.error('usage: node test/headless/run.mjs --fixture <file> [--seed N] [--out <file>] [--trace N]');
    process.exit(2);
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const seed = parseInt(arg('seed', fixture.seed ?? 42), 10);
const traceLimit = parseInt(arg('trace', 400), 10);

const trace = [];
const { RNG, updateGlobals, Player, Simulation } = await loadEngine({ sod: fixture.globals.sod !== false, trace });
RNG.seed(seed);

updateGlobals(fixture.globals);
const player = new Player(undefined, undefined, undefined, fixture.playerConfig);
if (!player.mh) throw new Error('fixture selects no weapon');
let report = null;
const sim = new Simulation(player, (r) => { report = r; }, null, fixture.simConfig);
sim.startSync();
report.player = player.serializeStats();
const spread = sim.spread;

function sortedByKey(obj, pick) {
    const out = {};
    for (const key of Object.keys(obj).sort()) {
        const val = pick(obj[key]);
        if (val) out[key] = val;
    }
    return out;
}

const golden = {
    fixture: fixture.name,
    seed,
    iterations: report.iterations,
    totaldmg: report.totaldmg,
    totalduration: report.totalduration,
    meandps: report.totaldmg / report.totalduration,
    mindps: report.mindps,
    maxdps: report.maxdps,
    sumdps: report.sumdps,
    sumdps2: report.sumdps2,
    spread: Object.fromEntries(spread.map((count, dps) => [dps, count]).filter(Boolean)),
    spells: sortedByKey(report.player.spells, (s) =>
        (s.totaldmg || s.data?.some(Boolean))
            ? { name: s.name, totaldmg: s.totaldmg, data: s.data }
            : null),
    auras: sortedByKey(report.player.auras, (a) =>
        (a.uptime || a.totaldmg)
            ? { name: a.name, uptime: a.uptime, totaldmg: a.totaldmg ?? 0 }
            : null),
    mh: { name: report.player.mh.name, totaldmg: report.player.mh.totaldmg, totalprocdmg: report.player.mh.totalprocdmg, data: report.player.mh.data },
    oh: report.player.oh
        ? { name: report.player.oh.name, totaldmg: report.player.oh.totaldmg, totalprocdmg: report.player.oh.totalprocdmg, data: report.player.oh.data }
        : null,
    trace: trace.slice(0, traceLimit),
};

const json = JSON.stringify(golden, null, 2) + '\n';
const out = arg('out');
if (out) {
    fs.writeFileSync(out, json);
    hostConsole.error(`wrote ${out} (${golden.iterations} iterations, mean dps ${golden.meandps.toFixed(2)})`);
} else {
    process.stdout.write(json);
}
