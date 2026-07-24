// Parity gate: re-runs every fixture and byte-compares against its golden.
// Also proves the seed is wired in: a different seed must NOT reproduce the
// golden. Exits non-zero on any mismatch. Run from the repo root:
//
//   node test/headless/check.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './sandbox.mjs';

const fixturesDir = path.join(ROOT, 'test/fixtures');
const goldenDir = path.join(ROOT, 'test/golden');
const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
if (!fixtures.length) {
    console.error('no fixtures found — run capture-fixtures.mjs first');
    process.exit(2);
}

let failed = 0;
for (const file of fixtures) {
    const name = file.replace(/\.json$/, '');
    const goldenPath = path.join(goldenDir, file);
    if (!fs.existsSync(goldenPath)) {
        console.error(`FAIL ${name}: missing golden ${path.relative(ROOT, goldenPath)}`);
        failed++;
        continue;
    }
    const golden = fs.readFileSync(goldenPath, 'utf8');
    const seed = JSON.parse(golden).seed;

    const runAt = (s) => execFileSync(process.execPath,
        [path.join(ROOT, 'test/headless/run.mjs'), '--fixture', path.join(fixturesDir, file), '--seed', String(s)],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    if (runAt(seed) !== golden) {
        console.error(`FAIL ${name}: output diverged from golden at seed ${seed}`);
        failed++;
        continue;
    }
    if (runAt(seed + 1) === golden) {
        console.error(`FAIL ${name}: seed ${seed + 1} reproduced the seed-${seed} golden — PRNG not wired in`);
        failed++;
        continue;
    }
    console.error(`ok   ${name}`);
}
process.exit(failed ? 1 : 0);
