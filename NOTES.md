# Notes

Findings that are not code changes: suspected data/math bugs (documented, not
fixed — see PROMPT.MD constraints), fork triage, performance baselines.

## Suspected bugs (behavior preserved, do not fix silently)

- `SimulationWorkerParallel.update()` (simulation.js:95): merges worker
  results with `result.maxdps = Math.min(result.maxdps, data.maxdps)` —
  almost certainly should be `Math.max`. UI-side aggregation only; does not
  affect engine math. Candidate fix for Phase 1 with explicit approval.
- **buffs 455864 "Faerie Fire Hit" has `armor: true`** (buffs.ts:1263). The
  engine computes `target.basearmorbuffed -= buff.armor`, so `true` coerces
  to 1 and the buff subtracts exactly 1 armor. Every other buff in the
  Sunder/Expose/Faerie Fire family carries a real number (the era Faerie
  Fire uses 505). The correct value here is a game-data question (SoD
  "improved" FF?), so it is NOT fixed — tracked as the one allowlisted
  schema violation in `test/data-anomalies.json`.

## Data-layer findings (Phase 2 schema validation, 2026-07-24)

Schemas: `js/data/schemas.ts`; gate: `test/data.test.mjs` (every entry in
every table, new violations fail CI).

- **Fixed (unambiguous number-where-string typos):** gear_sod ilvl `i`
  values were bare numbers on 4 items — 6460 Cobrahn's Grasp, 19120 Rune of
  the Guard Captain (×2 slots), 211449 Avenger's Void Pearl (×2 slots),
  209563 Naga Heartrender — vs numeric strings on the other 5726 entries.
  Mixed types missort the UI ilvl column; the engine never reads `i`, so
  parity is unaffected (verified).
- **Documented conventions (schema-accepted, not bugs):** quality `q`, ilvl
  `i`, `ench`, proc `interval`/`duration` are numeric strings; `phase` mixes
  number and numeric string freely (normalization candidate for codegen);
  gear ids are number, `"itemid|suffixid"` (2406 random-suffix items), or
  letter-suffixed variants (`"213319a"` = Machinist's Gloves modeled without
  its AP proc); levelstats rows are raw CSV strings.
- **Dead upstream field:** capitalized `Mainhand: true` on 26 classic
  weapons — nothing in the engine or UI reads it (the live flag pattern is
  lowercase `offhand`). Left in place to stay diffable against upstream.

## Toolchain

- `npm install` fails on Node 24 (node-sass 4.x / node-gyp 3.x). The gulp
  pipeline is dead on modern Node; the committed `dist/` output is what
  deploys today. Replaced by Vite in Phase 1 — do not sink time into gulp.

## Parity-coverage gaps (candidates for more fixtures)

- Classic (era) mode: `classic.html` + `gear.js` + `session.js` path has no
  fixture yet; all 11 fixtures are SoD level 60.
- Low-level SoD brackets (25/40) — `rageconversion` has hardcoded values for
  those levels that are untested headless.
- `batchedextras` (batch-aligned extra attacks) — no equipped proc in the
  current fixtures feeds it (Windfury uses `extraattacks`).
- Item/enchant/stat-weight comparison runs (`testItem`/`testType`/`enchtype`
  ctor args) are not exercised headless.

## Fork triage (88 upstream forks, scanned 2026-07-24)

45 forks have pushes; 16 are ahead of upstream. Do not merge anything —
candidates only.

**Cherry-pick candidate:**

- `matvb90/WarriorSim` `3d8cec1` (May 2026, 1 ahead / 0 behind): adds a
  "Positive Charge" buff (spell 28059, Thaddius polarity, `dmgmod`/
  `spelldmgmod` 190) to `buffs.js`. Clean and additive on current upstream.
  Game-data caveat: the 190 value and stack assumption need in-game/log
  verification before adopting.

**Noted, not candidates:**

- `goreblaster/WarriorSimEpoch` (6 ahead / 0 behind): Project Epoch total
  conversion (sod->epoch rename, rune removal) — a divergent product, but
  proof people still fork this codebase for new servers; the Phase 1+
  modularization should keep such conversions easy.
- `splashysun/warriorsim` (1 ahead): guts player.js to 158 lines —
  experimental/destructive, discard.
- `Zebouski/WarriorSim-TurtleWoW` (469 ahead): TurtleWoW total conversion,
  not cherry-pickable.
- `dylan-smith/WarriorSim` (2023, 803 behind): had a CI/CD workflow and
  Loatheb buff on the classic-era base — both superseded by this project's
  own plans.
- `HOYS/WarriorSim` (2021, 799 behind): frost-resistance gear/UI for
  classic-era Naxx — obsolete base.
- Remainder: jekyll themes, gear tweaks on 2020-era bases, personal
  profiles — nothing worth porting.

## Performance baselines

The numbers the Rust engine must beat (PROMPT.MD Phase 3 step 6). Measured
2026-07-24 with `test/headless/bench.mjs` (seeded, logging off, best of 3),
Node v24.18.0 on a QEMU virtual CPU — re-baseline on real hardware before
drawing Rust comparisons, but relative shape is what matters:

| fixture (workload)                         | iterations/sec |
| ------------------------------------------ | -------------- |
| thbwl (2H, 50–60s fights)                  | ~3,450         |
| dwbwl (dual-wield, 50–60s — heaviest)      | ~995           |
| thbwl-long-startrage (2H, 120–180s fights) | ~1,440         |

CPU profile (dwbwl, `node --cpu-prof`): `Simulation.run` 22% self time
(next-event loop bookkeeping), `startSync` 9%, then `Player.cast` ~5%,
`stepauras` ~9% across inlinings, `attackmh/oh` ~8%, `updateDmgMod` ~5%,
aura `canUse/step/use` ~6%. No single dominant hotspot — the loop itself and
per-event aura bookkeeping spread the cost, which is the expected profile
for the Rust port to attack structurally (flat arrays over dict-keyed aura
maps) rather than micro-optimizing JS.
