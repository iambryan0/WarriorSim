# WarriorSim Modernization — Agent Brief

## Context

You are working in a fork of `GuybrushGit/WarriorSim`, a browser-based Monte Carlo DPS simulator for Classic WoW / Season of Discovery warriors. It is vanilla ES5/ES6 JavaScript with a gulp concat/uglify build, jQuery-era UI, and a Web Worker running the sim loop. Last upstream commit: Dec 2024. The sim math is community-validated against in-game combat logs — **it is the most valuable thing in this repo and must not silently change.**

Codebase map (line counts approximate):
- `js/classes/simulation.js` (~740) — Monte Carlo driver, event loop, runs inside Web Worker (`js/sim-worker.js`)
- `js/classes/player.js` (~1,750) — stats, rage, auras, proc handling
- `js/classes/spell.js` (~3,000) — every ability, aura, and proc definition
- `js/classes/weapon.js` (~140) — swing timers, attack table rolls
- `js/data/*.js` (~95k lines) — gear, enchants, buffs, talents, runes, level stats. `gear_sod.js` alone is ~78k lines. These are static data tables, not logic.
- `js/ui.js`, `js/settings.js`, `js/profiles.js`, `js/stats.js` — UI, localStorage profiles, results/stat display
- `gulpfile.js` + `dist/` — legacy build; site deploys via GitHub Pages

## Mission

Three phases, strictly in order. Do not start a phase until the previous phase's acceptance criteria pass.

1. **Phase 1 — Modernize the build and migrate to TypeScript** (behavior-preserving)
2. **Phase 2 — Type the data layer and harden the engine** (behavior-preserving)
3. **Phase 3 — Extract the sim engine to Rust compiled to WASM** (bit-for-bit validated against the JS engine)

## Global constraints

- **Never alter simulation math or game-mechanic constants** (attack table values, proc rates, rage formulas, aura durations, batching behavior) unless explicitly instructed. If you find what looks like a bug in the math, document it in `NOTES.md` and leave the behavior intact.
- Deployment target is Cloudflare Pages: output must remain a static site.
- Preserve localStorage profile compatibility — existing users' saved gear sets must load after every phase.
- Work in small, reviewable commits with conventional-commit messages. One logical change per commit.
- Maintain a `MIGRATION.md` log: what changed, what was verified, open questions.
- Run the validation harness (defined below) after every significant change; never commit with a failing parity check.

## Phase 0 — Recon and safety net (do this first, ~1 session)

1. Read `simulation.js`, `player.js`, `spell.js`, `weapon.js` end to end. Write a short architecture doc (`ARCHITECTURE.md`): the event loop model, how time advances, how the worker communicates with the UI, where randomness enters, and the full list of entry points into the engine.
2. **Build the determinism/parity harness before touching anything:**
   - Locate every `Math.random()` call site. Introduce a seedable PRNG (e.g., mulberry32) injected into the engine, defaulting to `Math.random` in production so live behavior is unchanged.
   - Create `test/fixtures/`: 8–12 representative sim configurations (fury DW, arms 2H, SoD rune combos, different fight lengths, execute phase, multi-target if supported) captured as JSON.
   - Create a headless runner (Node) that executes the engine outside the browser with a fixed seed and dumps: final DPS, per-ability damage breakdown, proc counts, rage stats, and a truncated event trace.
   - Snapshot these outputs as golden files. **This is the contract for the entire project.**
3. Check the 88 upstream forks for meaningful fixes worth cherry-picking; list candidates in `NOTES.md`, do not merge yet.

**Acceptance:** headless runner produces identical golden output across repeated runs with the same seed; browser sim still works.

## Phase 1 — Vite + TypeScript migration (behavior-preserving)

1. Replace gulp with Vite. Entry points: main app + worker (use Vite's native worker support). Keep `dist/` output deployable to Cloudflare Pages.
2. Convert to ES modules. The current code relies on script-tag ordering and shared globals — make the dependency graph explicit. Do this file by file, running the parity harness after each.
3. Rename `.js` → `.ts` with `allowJs: true` and a permissive tsconfig first; the codebase must compile and pass parity before any real typing begins.
4. Then tighten incrementally: `noImplicitAny` per-directory, starting with `classes/`. Type the engine's internal interfaces (Player, Spell, Aura, Proc, SimConfig, SimResult). Use `// @ts-expect-error` sparingly and log each one in `MIGRATION.md`.
5. Add tooling: ESLint (typescript-eslint), Prettier, Vitest. Port the parity harness to Vitest. Add a GitHub Actions workflow: lint → typecheck → parity tests → build; deploy via Cloudflare Pages git integration on main.
6. Leave the UI code loosely typed for now — it is not the priority. Do not redesign the UI.

**Acceptance:** `npm run build` produces a working static site; all golden parity tests pass; CI green; `tsc --noEmit` passes with the tightened config on `classes/`.

## Phase 2 — Type the data layer, harden the engine

1. Do **not** hand-annotate the data files. Write a codegen/validation script:
   - Define Zod (or similar) schemas for Item, Enchant, Buff, Talent, Rune, LevelStats.
   - Parse and validate every entry in `js/data/*` against the schemas at build time. Emit typed modules (or `.d.ts`) from the schemas.
   - Every schema violation found is a real data bug — log them all in `NOTES.md` with item IDs; fix only unambiguous typos (wrong field name, string where number expected), never stat values, without flagging.
2. Strictify the engine: `strict: true` on `classes/`. Eliminate implicit anys and unsound casts.
3. Expand the test suite beyond parity snapshots with **unit tests for isolated mechanics**, each asserting against known Classic formulas (cite the formula source in the test comment): attack table (glancing/dodge/miss/crit at weapon-skill deltas 0/5/10/15), rage generation from damage dealt/taken, flurry uptime math, HS queue behavior, proc PPM vs fixed-chance handling.
4. Profile the JS engine (Node `--cpu-prof` on the headless runner). Record baseline iterations/sec in `NOTES.md` — this is the number Rust must beat.

**Acceptance:** data layer fully schema-validated in CI; engine compiles under `strict`; mechanic unit tests pass; parity goldens unchanged (or every diff explained and approved in `MIGRATION.md`).

## Phase 3 — Rust/WASM engine

1. Workspace layout:
   - `engine/` — Rust crate, `no_std`-unnecessary but zero-JS-dependency core. Pure logic: same event loop, same attack table, same proc handling.
   - `engine/` builds two targets: `wasm32-unknown-unknown` via `wasm-bindgen` + `wasm-pack`, and a native CLI (`cargo run --release -- --config fixture.json --seed 42`) for batch runs and benchmarking.
2. **Port strategy:** translate `weapon.js` → `spell.js` → `player.js` → `simulation.js`, in that order, module by module. Use the same seedable PRNG algorithm (mulberry32) so a given seed produces the *identical* event sequence in JS and Rust. This is the core validation trick: with matching PRNGs, outputs must match exactly, not statistically.
3. Validation gates, in increasing strictness:
   - Event-trace diff: first 10k events identical for each fixture/seed.
   - Full-run parity: final DPS and per-ability breakdowns match JS to within f64 rounding (document any float-order divergence and resolve it — restructure arithmetic order rather than widening tolerances).
   - Statistical check: 100k-iteration runs with random seeds, distributions match JS within confidence intervals.
4. Integration: feature-flag in the UI — "engine: JS | WASM". Ship both initially. The worker loads the WASM module and exposes the same message protocol so the UI is unchanged.
5. Parallelism: after single-thread parity is proven, add rayon for the native CLI and wasm threads (SharedArrayBuffer requires COOP/COEP — set these via a `_headers` file in the build output, which Cloudflare Pages supports natively).
6. Benchmark against the Phase 2 baseline; record results in `NOTES.md`.

**Acceptance:** all fixtures pass exact-parity with matched seeds; WASM engine selectable in the UI and produces identical results to JS; native CLI runs; benchmark shows a real speedup.

## Working style

- Ask before making irreversible or architectural decisions not covered here.
- When the sim's behavior is ambiguous (e.g., undocumented batching quirk), preserve existing behavior and flag it — correctness against the *game* is a separate research task, not yours.
- Prefer boring, explicit code over clever code. The audience is future contributors who know WoW mechanics better than they know Rust.
- If a phase is going sideways (parity breaks you can't explain within a session), stop, write up findings in `MIGRATION.md`, and surface it rather than pushing forward.

## Definition of done

A CI-green repo where: the site deploys to Cloudflare Pages from Vite; the engine is strict TypeScript with schema-validated data; a Rust crate reproduces the JS engine bit-for-bit under seeded runs and is selectable in the UI; a native CLI enables batch simulation; and `ARCHITECTURE.md`/`MIGRATION.md`/`NOTES.md` let any contributor pick up where you left off.