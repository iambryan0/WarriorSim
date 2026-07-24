// Engine throughput benchmark: runs a fixture at a large iteration count and
// reports iterations/sec — the Phase 2 baseline the Rust engine must beat
// (results recorded in NOTES.md). Deterministic (seeded), logging disabled.
//
//   node test/headless/bench.mjs [--fixture test/fixtures/thbwl.json]
//     [--iterations 20000] [--repeat 3]
//
// For a CPU profile: node --cpu-prof --cpu-prof-dir=/tmp test/headless/bench.mjs
import fs from 'node:fs';
import { hostConsole, loadEngine } from './sandbox.mjs';

function arg(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i > -1 ? process.argv[i + 1] : fallback;
}

const fixturePath = arg('fixture', 'test/fixtures/thbwl.json');
const iterations = parseInt(arg('iterations', '20000'), 10);
const repeat = parseInt(arg('repeat', '3'), 10);

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const { RNG, updateGlobals, Player, Simulation } = await loadEngine({ sod: fixture.globals.sod !== false });

updateGlobals(fixture.globals);
const playerConfig = { ...fixture.playerConfig, logging: false };
const simConfig = { ...fixture.simConfig, iterations };

for (let run = 0; run < repeat; run++) {
    RNG.seed(fixture.seed ?? 42);
    const player = new Player(undefined, undefined, undefined, playerConfig);
    let report = null;
    const sim = new Simulation(player, (r) => (report = r), null, simConfig);
    const t0 = process.hrtime.bigint();
    sim.startSync();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    hostConsole.error(
        `${fixture.name}: ${iterations} iterations in ${ms.toFixed(0)}ms — ` +
            `${Math.round(iterations / (ms / 1000))} it/s (meandps ${(report.totaldmg / report.totalduration).toFixed(2)})`,
    );
}
