# Migration Log

Running log of the modernization (see `PROMPT.MD` for the plan). Newest first
within each phase. Every entry: what changed, how it was verified, open
questions.

## Phase 1 — Vite + TypeScript migration

### Engine typing: noImplicitAny + core interfaces (branch `phase1/engine-types`)
- `tsconfig.engine.json` (extends root, `noImplicitAny: true`) covers
  `classes/`, `rng`, `globals`, `sim-worker`, `data/mode`;
  `npm run typecheck` runs both projects. 448 implicit-any errors → 0.
- New `js/engine-types.ts`: `PlayerConfig`/`TargetConfig`/`SimConfig`/
  `SimResult`/`ProcDef`/`WorkerParams` + the worker callback types — the
  shapes that cross module boundaries (worker protocol, DOM/headless
  configs, reports). Config/report interfaces keep an index-signature escape
  hatch until Phase 2 strict mode; the sprawling per-instance stat fields on
  Player/Spell/Aura likewise stay index-signature-loose (documented debt).
- Signatures annotated with real types where semantics are certain
  (`player: Player`, `spell: Spell | null`, `weapon: Weapon`,
  `config?: SimConfig`, enum results as `number`), explicit `any` where the
  legacy calling conventions are genuinely loose (adjacent, delayedheroic).
  Type-only imports (`import type`) keep the runtime graph acyclic. Zero
  `@ts-expect-error` needed.
- `callback_update(...args)`/`callback_finished(...args)` in the worker
  message dispatch became explicit `args[0], args[1]` calls (same arity the
  messages always had) — the only non-annotation edits.
- Verified: both tsc projects clean, eslint/prettier clean, parity 11/11
  byte-identical, minified worker-protocol bundle check exact.

### TypeScript rename, permissive compile (branch `phase1/ts-rename`)

- Every `js/**/*.js` → `.ts` (git mv, history preserved); import specifiers
  and harness paths follow. Node ≥23.6 type-stripping runs the `.ts` engine
  directly, so the parity harness needed only path updates; Vite handles
  `.ts` entries/worker natively. `tsc --noEmit` passes on a deliberately
  permissive tsconfig (strict/noImplicitAny off — tightening is the next
  step, per the brief).
- Getting to zero tsc errors (5139 → 0) used only type-level edits: index
  signatures on the core classes, `any` annotations on empty-object literals
  and the data tables (schema-typed properly in Phase 2), optional trailing
  params where JS call sites legitimately pass fewer args, base
  `Spell/Aura.use/dmg(...args)` so subclass overrides stay assignable, and
  `as any` casts on loose parseInt/toFixed coercions. Zero runtime-visible
  changes, confirmed by parity.
- **tsc caught two real regressions the ESM-UI conversion had shipped**,
  both invisible to the engine-only parity harness:
    - `ui.ts` assigned `player` without declaration — a sloppy-mode implicit
      global that throws in strict module code, breaking the Run button.
      Fixed with a module-scoped `let player`.
    - `WEB_DB_URL` lived in ui.js but was used from settings.js — worked as a
      cross-script global, broke under module scoping. Now exported/imported.
      Lesson recorded: UI has no automated coverage; browser smoke after UI
      changes is mandatory until it does.
- New npm scripts: `typecheck`, `parity:bundle`.

### UI to ES modules, fully bundled site (branch `phase1/esm-ui`)

- ui.js/settings.js/stats.js/profiles.js are ES modules importing the engine
  and data explicitly; the shared `SIM` namespace lives in `js/sim-ns.js`
  (module version of the old `var SIM = SIM || {}` pattern, so internal
  SIM.X.Y cross-references stay untouched). The pages' inline
  `$(document).ready(init)` block and `var mode` scripts moved into the
  entries; `js/data/mode.js` now also carries `mode` and `session`.
  jQuery/tablesorter/Chart remain vendored classic scripts in `public/libs`.
- Every interim globalThis shim is gone — the dependency graph is imports
  only. The `copy-legacy-js` plugin is gone; `npm run build` fully bundles
  both pages and the worker (worker spawned via
  `new Worker(new URL('../sim-worker.js', import.meta.url), {type:'module'})`
  so Vite's worker pipeline picks it up).
- Worker protocol gained an optional `seed` field (RNG.seed before the run;
  UI never sends it — production behavior unchanged). Used by the bundle
  parity check now and by the Phase 3 Rust/WASM validation later.
- Parity harness is plain native ESM now: sandbox.mjs imports the engine
  directly (no vm, no --experimental-vm-modules), fresh process per fixture.
  check-bundle.mjs drives the MINIFIED worker chunk through the real message
  protocol and matches the golden exactly. That check caught keepNames not
  propagating to Vite's separate worker build — fixed via
  `worker.rollupOptions.output.keepNames`.
- Bundle sizes: sod chunk ~1.0 MB min (~170 KB gz; dominated by the 78k-line
  gear_sod table), worker ~1.1 MB (inlines both mode tables — code-splitting
  candidate for later, not correctness). Chunk-size warning is expected.
- Verified: 11/11 goldens byte-identical; bundle check exact via worker
  protocol; asset sweep on the built pages all-200.

### Engine to ES modules (branch `phase1/esm-engine`)

- All engine-loaded files are now real ES modules with explicit imports:
  `rng.js`, every `js/data/*`, the four `js/classes/*`, `js/globals.js`.
  Tables went `var` → `export const` with no content changes (they are
  mutated in place, never reassigned — verified before converting).
  `step`/`batching` are `export let` in simulation.js, written only there,
  read elsewhere through live bindings. The engine module graph is acyclic
  except simulation ↔ spell (runtime-only references, safe under ESM).
- Mode selection is explicit now: new `js/data/mode.js` holds `gear`/`runes`
  live bindings, installed by the page entries (`main-sod.js` /
  `main-classic.js`) or by the worker from its first message via dynamic
  import — replacing the old "which script tag loaded" mechanism. `runes`
  stays undefined in classic mode so the engine's `typeof runes` guards
  behave identically.
- `eval('new ' + name + '(...)')` (6 sites) replaced by
  `createSpell()`/`SPELL_CLASSES`, an explicit map of all 82 classes the data
  files reference by string (scan covered quoted and unquoted
  `spell`/`procspell`/`classname` keys; first scan missed the JSON-quoted
  ones — caught by the parity gate). Unknown names now throw.
- `js/sim-worker.js` is a module worker (`{ type: 'module' }`), same message
  protocol. UI files stay classic scripts for now and reach the engine
  through interim `Object.assign(globalThis, ...)` shims at module ends —
  tracked for removal when the UI converts.
- Parity harness upgrades:
    - sandbox loads mixed classic/ESM engine files in ONE vm context
      (`vm.SourceTextModule`, `--experimental-vm-modules`; the flag drops out
      once the harness can import the engine natively). A first attempt at
      global-realm `(0, eval)` loading failed — top-level `class` declarations
      do not persist across indirect evals, unlike real `<script>` tags.
    - new `test/headless/check-bundle.mjs` runs a fixture through the MINIFIED
      Vite build and byte-compares aggregates against the golden. It caught
      the one real minification hazard: Spell/Aura default their display name
      to `constructor.name`, so the build sets rolldown `output.keepNames`
      (Vite 8 silently ignores `terserOptions` — verified empirically).
- Verified: 11/11 goldens byte-identical (exit code checked — an earlier
  piped `tail` masked a real failure once; lesson noted), bundle check exact
  on meandps + intact class names, classic-mode context loads, built site
  serves, dev server transforms the module worker.
- Deleted `js/data/races.js` (no consumers; Phase 0 open question resolved).

### Vite replaces gulp (branch `phase1/vite-build`)

- `vite.config.js`: MPA build with `index.html` + `classic.html` as inputs;
  `npm run dev/build/preview`. gulp, its deps, and the committed `dist/`
  artifacts are gone; `dist/` is now the gitignored Vite output.
- Vendored assets moved out of `dist/` into `public/` (`libs/` jQuery/
  tablesorter/Chart, `css/theme.default.min.css`, `img/`, `favicon.ico`).
  Favicon href changed from the GitHub-Pages `/WarriorSim/` prefix to `/` —
  deployment target is Cloudflare Pages at the domain root.
- `scss/style.scss` now compiles through Vite via the first module entry
  (`js/main.js`); race-icon urls in `sidebar.scss` switched from `../img/` to
  `/img/` (public asset refs, resolved identically in dev and build).
- Interim until the ESM conversion: engine/UI files stay classic ordered
  `<script>` tags pointing at raw `js/` sources (unminified), copied verbatim
  into the build by the `copy-legacy-js` plugin. Worker path is now
  `/js/sim-worker.js` (was `dist/js/sim-worker.min.js`), `importScripts`
  un-minified to match.
- Verified: parity green (engine edits were path strings only); `npm run
build` output serves with every referenced asset resolving (curl sweep over
  both pages' src/href); dev server serves both pages, worker, libs, images.
- Known noise: Dart Sass deprecation warnings for `@import` in the scss —
  left as-is (migrating to `@use` is cosmetic churn; revisit if Sass 3 lands).

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
- All 11 parity fixtures are SoD-mode (they derive from the shipped presets,
  which are SoD-only). Classic mode is covered by a load smoke test but has
  no golden — worth adding a hand-built classic fixture before Phase 3.
