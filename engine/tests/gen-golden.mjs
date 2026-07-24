// Generates tests/prng-golden.json from the REAL JS implementation
// (js/rng.ts), so the Rust parity test validates against the engine's own
// PRNG, not a reimplementation. Rerun after any change to js/rng.ts:
//
//   node engine/tests/gen-golden.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { RNG } = await import(path.join(here, '../../js/rng.ts'));

const golden = {};
for (const seed of [0, 1, 42, 123456789, 0xffffffff]) {
    RNG.seed(seed);
    // 64-bit float bits as hex strings — bit-exact comparison, no float
    // parsing ambiguity.
    golden[seed >>> 0] = Array.from({ length: 64 }, () => {
        const buf = new DataView(new ArrayBuffer(8));
        buf.setFloat64(0, RNG.random());
        return buf.getBigUint64(0).toString(16).padStart(16, '0');
    });
}
const out = path.join(here, 'prng-golden.json');
fs.writeFileSync(out, JSON.stringify(golden, null, 2) + '\n');
console.error(`wrote ${out}`);
