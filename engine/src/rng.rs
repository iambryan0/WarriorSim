//! Seedable PRNG matching `js/rng.ts` bit for bit.
//!
//! The JS engine's deterministic mode is mulberry32 implemented on JS 32-bit
//! integer semantics: `|0` (i32 wrap), `>>>` (u32 shift), `Math.imul`
//! (wrapping 32-bit multiply). All of those are plain wrapping u32 ops here —
//! same bit patterns, and the final `>>> 0` / 2^32 division is exact in f64,
//! so a given seed must produce the identical f64 sequence in both engines.
//! Validated by tests/prng_parity.rs against a golden sequence generated from
//! the JS implementation.

#[derive(Clone, Debug)]
pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    /// Next draw in [0, 1), identical to `RNG.random()` after `RNG.seed()`.
    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let a = self.state;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }

    /// `rng(min, max)` from js/classes/simulation.ts: inclusive integer in
    /// [min, max] via `~~(random * (max - min + 1)) + min`.
    pub fn rng(&mut self, min: i64, max: i64) -> i64 {
        (self.next_f64() * ((max - min + 1) as f64)) as i64 + min
    }

    /// `rng10k()` from js/classes/simulation.ts: integer in [0, 9999].
    pub fn rng10k(&mut self) -> i64 {
        (self.next_f64() * 10_000.0) as i64
    }
}
