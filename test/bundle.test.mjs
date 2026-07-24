// Vitest wrapper around the minified-bundle parity check (see
// test/headless/check-bundle.mjs). Requires `npm run build` first — CI runs
// it after the build step; locally it skips with a notice when dist/ is
// absent.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './headless/sandbox.mjs';

const assetsDir = path.join(ROOT, 'dist/assets');
const built =
    fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).some((f) => f.startsWith('sim-worker') && f.endsWith('.js'));

describe('minified bundle parity', () => {
    it.skipIf(!built)('worker chunk reproduces the golden via the message protocol', () => {
        const out = execFileSync(process.execPath, [path.join(ROOT, 'test/headless/check-bundle.mjs')], {
            encoding: 'utf8',
        });
        expect(out).toBe('');
    });
});
