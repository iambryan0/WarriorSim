# Notes

Findings that are not code changes: suspected data/math bugs (documented, not
fixed — see PROMPT.MD constraints), fork triage, performance baselines.

## Suspected bugs (behavior preserved, do not fix silently)

- `SimulationWorkerParallel.update()` (simulation.js:95): merges worker
  results with `result.maxdps = Math.min(result.maxdps, data.maxdps)` —
  almost certainly should be `Math.max`. UI-side aggregation only; does not
  affect engine math. Candidate fix for Phase 1 with explicit approval.

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

_(Phase 2: Node --cpu-prof on the headless runner; the number Rust must beat)_
