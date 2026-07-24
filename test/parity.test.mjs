// Vitest wrapper around the golden parity gate. Each fixture runs in a fresh
// subprocess (module state is process-wide) exactly like check.mjs, byte-
// compares against its golden, and proves the seed is wired in by asserting
// seed+1 diverges. check.mjs remains the dependency-free CLI equivalent.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './headless/sandbox.mjs';

const fixturesDir = path.join(ROOT, 'test/fixtures');
const goldenDir = path.join(ROOT, 'test/golden');
const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

const runAt = (file, seed) =>
    execFileSync(
        process.execPath,
        [path.join(ROOT, 'test/headless/run.mjs'), '--fixture', path.join(fixturesDir, file), '--seed', String(seed)],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

describe('golden parity', () => {
    it('has fixtures', () => {
        expect(fixtures.length).toBeGreaterThan(0);
    });

    for (const file of fixtures) {
        const name = file.replace(/\.json$/, '');
        it(`${name} is byte-identical to its golden`, () => {
            const golden = fs.readFileSync(path.join(goldenDir, file), 'utf8');
            expect(runAt(file, JSON.parse(golden).seed)).toBe(golden);
        });
        it(`${name} diverges at seed+1 (PRNG wired in)`, () => {
            const golden = fs.readFileSync(path.join(goldenDir, file), 'utf8');
            expect(runAt(file, JSON.parse(golden).seed + 1)).not.toBe(golden);
        });
    }
});
