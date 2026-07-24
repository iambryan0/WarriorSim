# WarriorSim Engine Architecture

Recon notes for the modernization effort (see `PROMPT.MD`). Line numbers refer
to the state at the time of writing; treat them as landmarks, not contracts.

## Big picture

The simulator is a Monte Carlo event-driven loop over one warrior hitting one
(or more adjacent) targets. All code is global-scope ES6 loaded via ordered
`<script>` tags (page) or `importScripts` (worker). There is no module system;
the load order **is** the dependency graph:

```
data/buffs.js  data/enchants.js (also defines `sets`)  data/levelstats.js
data/spells.js (rotation config)  data/talents.js
classes/player.js  classes/simulation.js  classes/spell.js  classes/weapon.js
globals.js (updateGlobals/getGlobalsDelta)
gear_sod.js + runes.js   (SoD mode)  |  gear.js  (classic mode)
```

`index.html` (SoD) and `classic.html` (era) load the same engine with
different data files; `globalThis.mode` ("sod"/"classic") switches behavior.

## Worker protocol (UI <-> engine)

`js/ui.js` spawns `SimulationWorkerParallel` (one `SimulationWorker`, i.e. one
Web Worker, per thread; iterations split across workers, worker 0 carries
`logging`/full report). Message **to** worker (`js/sim-worker.js`):

```js
{
  globals: getGlobalsDelta(),   // talents/buffs/rotation/gear/enchant/runes/sod
  player:  [testItem, testType, enchtype, Player.getConfig()],  // ctor args
  sim:     Simulation.getConfig(),  // timesecs min/max, executeperc, startrage, iterations, batching
  fullReport: bool,
}
```

Worker sequence: `updateGlobals(params.globals)` -> `new Player(...params.player)`
-> `new Simulation(player, onFinish, onUpdate, params.sim)` -> `sim.startSync()`.
Messages back: `[TYPE.UPDATE, iteration, {iterations,totaldmg,totalduration}]`
and `[TYPE.FINISHED, report]` where report adds `mindps/maxdps/sumdps/sumdps2/
starttime/endtime` plus (fullReport) `player: player.serializeStats()` (live
aura/spell/weapon objects) and `spread` (dps histogram).
`SimulationWorkerParallel.update()` merges per-worker reports by summation.

The `player` ctor array supports the item/enchant/stat-weight comparison runs:
`testItem`/`testType`/`enchtype` isolate one item, enchant, or raw stat delta
(see `Player` constructor dispatch, `player.js:24-177`).

## The event loop (`Simulation.run()`, simulation.js:238)

- Time is integer **milliseconds** in the module-global `step`; per-iteration
  fight length `maxsteps = rng(timesecsmin*1000, timesecsmax*1000)`.
- It is a *next-event* loop, not a fixed tick: each pass handles anything due
  now (auto-attacks when `mh.timer <= 0`, delayed ability casts, HS queue,
  slam cast completion, extra attacks), then computes `next` = minimum over
  every pending timer (weapon swings, GCD `player.timer`, item/stance/rage
  timers, ability cooldowns, DoT ticks, periodic rage sources) and advances
  `step += next`, decrementing all timers via `step(next)` dispatch lists.
- Ability usage is two-stage to model human latency: a `spellcheck` pass picks
  `delayedspell`/`delayedheroic` from priority-ordered `normalspells`/
  `executespells` (built in `Player.sortSpells()`), then the cast happens only
  once `player.spelldelay > delayedspell.maxdelay` where
  `maxdelay = rng(reactionmin, reactionmax)` rerolled per use — or immediately
  at GCD-end when spell queueing is enabled (`canSpellQueue`).
- Execute phase: `executestep = maxsteps - maxsteps*executeperc/100` switches
  the priority list.
- Heroic Strike/Cleave are on-next-swing flags (`player.nextswinghs`) with
  unqueue emulation (rage floor + swing-timer window).
- Slam blocks the loop via `slamstep` (cast time), with swing-reset quirks.
- End of iteration: bleed/proc `idmg` residuals summed, `player.endauras()`,
  dps accumulated into min/max/sum/sum^2 and `spread[round(dps)]`.

Batching: module-global `batching` (config, default 10ms) is the emulated
spell-batch window. Consumers: `Windfury.proc()` defers final-stack removal to
the batch boundary (spell.js:1536), `player.batchedextras` schedules extra
attacks at `batching - step % batching` (simulation.js:514), `Execute` has a
1ms batch-tick gate (spell.js:217).

## Combat math locations

- Attack tables: `player.rollweapon` (white, single `rng10k()` roll over
  miss/dodge/glance/crit), `rollmeleespell` (yellow, two-roll),
  `rollmagicspell` (player.js:1248-1291). Chances precomputed in
  `update()`/`getMissChance`/`getDodgeChance`/`getGlanceChance` from
  weapon-skill vs target defense deltas.
- Damage: per-spell `dmg()` in spell.js (raw), `Weapon.dmg()` (white), then
  `player.dealdamage` applies armor and triggers rage/procs.
- Rage: `player.addRage` (player.js:1023) — white-hit formula
  `dmg/rageconversion*7.5*ragemod`, dodge 75% of average, ability refunds,
  Unbridled Wrath, rune bonuses; hard cap 100.
- Procs: everything funnels through `player.procattack` (player.js:1487);
  chances stored as x/10000 vs `rng10k()`. Extra attacks accumulate in
  `player.extraattacks` (immediate) or `player.batchedextras` (batch-aligned).
- Auras: `player.auras` keyed by lowercased class name, instantiated via
  `eval('new ' + name + '(player)')` (player.js and weapon.js — note for the
  ESM migration: this couples class names to runtime strings in data files).
  Active == `aura.timer` truthy; stats recomputed by the `update*()` family.

## Randomness inventory (engine)

All engine randomness is `Math.random()` behind three helpers:

| Site | Definition | Used for |
|---|---|---|
| `rng(min,max)` simulation.js:730 | inclusive int | fight length, damage ranges, reaction delay, adjacent DoT target pick |
| `rng10k()` simulation.js:734 | int 0-9999 | every attack-table roll and proc chance |
| `Player.getGlanceReduction` player.js:992 | uniform float | glance damage multiplier |

`ui.js:1546` (uuid) and `settings.js:798-801` (snow easter egg) are UI-only.
`spell.js` and `weapon.js` contain no direct randomness.

## Browser-API coupling (worker/headless safety)

The engine core is worker-safe by construction. The full inventory of
browser touches in engine-loaded files:

- `Player.getConfig` / `Simulation.getConfig`: jQuery DOM reads — never called
  when a config object is passed (worker always passes one).
- `player.js:645`: `$("#currentarmor").text(...)` guarded by `typeof $`.
- `player.js` console warnings (overlapping procs) and `player.log()` ->
  `console.log` (only when `config.logging`).
- `globals.js getGlobalsDelta`: `window.location` (UI-side only);
  `updateGlobals` touches `$` only when passed `resistances`.
- `new Date().getTime()` in `Simulation.startSync/runAsync` (timing metadata
  only; excluded from parity goldens).

## Headless parity harness (`test/`)

`test/headless/sandbox.mjs` loads the engine unmodified into a Node `vm`
context in worker order and replaces `Math.random` in-context with seeded
mulberry32. `run.mjs` replays the worker sequence for a fixture and emits a
deterministic JSON report (aggregates, per-ability `data[RESULT]` histograms,
aura uptimes, dps spread, first-iteration event trace via captured
`player.log`). `capture-fixtures.mjs` builds fixtures from the shipped
presets replicating `importProfile()` + `getConfig()` semantics. `check.mjs`
is the gate: byte-identical rerun per fixture, divergence at seed+1.

Engine entry points exercised (the complete headless/worker surface):
`updateGlobals`, `new Player(testItem, testType, enchtype, config)`,
`new Simulation(player, cbFinished, cbUpdate, config)`, `sim.startSync()`,
`player.serializeStats()`, plus globals `step`/`batching` and the `TYPE`/
`RESULT`/`DEFENSETYPE`/`SCHOOL`/`WEAPONTYPE` enums.
