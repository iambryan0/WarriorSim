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

## Fork triage (88 upstream forks)

_(pending)_

## Performance baselines

_(Phase 2: Node --cpu-prof on the headless runner; the number Rust must beat)_
