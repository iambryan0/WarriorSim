// Seedable randomness source for the engine. Production behavior is
// unchanged: RNG.random defaults to Math.random. Deterministic runs (the
// parity harness, and later the Rust engine validation) call RNG.seed(n),
// which swaps in mulberry32 — the same algorithm both engines must share so
// that a given seed produces an identical event sequence.
export const RNG = {
    random: Math.random,
    seed(seed) {
        let a = seed >>> 0;
        this.random = function () {
            a |= 0;
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },
    reset() {
        this.random = Math.random;
    },
};
