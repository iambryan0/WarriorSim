# Migration Log

Running log of the modernization (see `PROMPT.MD` for the plan). Newest first
within each phase. Every entry: what changed, how it was verified, open
questions.

## Phase 0 — Recon and safety net

### Seedable PRNG injection (branch `phase0/rng-injection`)
- Added `js/rng.js` (`RNG.random`, defaulting to `Math.random`;
  `RNG.seed(n)` swaps in mulberry32). Rewired the three engine randomness
  sites (`rng`/`rng10k` in simulation.js, `getGlanceReduction` in player.js)
  to `RNG.random()`. Loaded first by `sim-worker.js`, both HTML pages, and
  the harness sandbox; harness now seeds via `RNG.seed()` instead of
  overriding `Math.random`.
- `dist/` counterparts regenerated with terser (default settings — no
  top-level mangling, required by the engine's `eval('new ClassName(...)')`
  instantiation). The gulp pipeline being dead on modern Node, this is the
  interim dist story until Vite lands in Phase 1.
- Verified: `check.mjs` — all 11 goldens byte-identical to the
  pre-refactor snapshots (same seed, same sequence through the new
  indirection). Production default path unchanged (`Math.random`).

### Parity harness (branch `phase0/parity-harness`)
- Added `test/headless/` (vm-sandbox runner, fixture capture, golden check)
  and 11 fixtures + goldens derived from the four shipped presets. No engine
  sources were modified: determinism comes from replacing `Math.random`
  inside the vm context with seeded mulberry32.
- Verified: `node test/headless/check.mjs` — every fixture byte-identical
  across reruns at its seed; seed+1 diverges (PRNG provably wired in).
- Fidelity notes:
  - Fixture `globals` use the storage shape that `SIM.UI.loadSession()`
    passes to `updateGlobals()` (selected-only deltas), not the full
    `getGlobalsDelta()` arrays. Equivalent because `updateGlobals` clears all
    selected flags before applying; keeps fixtures small.
  - Config objects mirror `Player.getConfig`/`Simulation.getConfig`
    field-for-field including string-typed `level`/`race`/`bleedreduction`
    (engine relies on loose coercion).
  - `starttime`/`endtime` (wall clock) are excluded from goldens.
- Observed no-ops that validated fidelity (kept as designed coverage
  instead): `executeperc` without Execute in rotation, `adjacent` without
  Whirlwind/Cleave, `spellqueueing` with 0ms reaction time — all produced
  byte-identical engine output. Final fixture set exercises each path for
  real (see `test/headless/capture-fixtures.mjs` FIXTURES comment).

### Recon (branch `phase0/architecture-doc`)
- Wrote `ARCHITECTURE.md` from an end-to-end read of the engine files.
- Baseline verified: static serve of the committed `dist/` works; gulp
  toolchain does not install on Node 24 (node-sass/node-gyp) — irrelevant,
  replaced by Vite in Phase 1.

## Open questions
- `version = 4` in simulation.js is written but never read anywhere found so
  far — confirm before dropping during the TS migration.
- `js/data/races.js` is loaded by neither page nor worker (race data is
  hardcoded in `Player.addRace`) — candidate for deletion in Phase 1.
