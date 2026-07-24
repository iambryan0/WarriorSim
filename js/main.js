// Shared Vite entry: stylesheet plus the mode-independent engine data.
// Mode-specific data (gear tables, session defaults, presets) is imported by
// the per-page entries main-sod.js / main-classic.js. The remaining engine/UI
// files join the module graph file by file during the ESM conversion (see
// MIGRATION.md) — until then they stay as ordered classic <script> tags and
// reach these modules through their globalThis shims.
import '../scss/style.scss';
import './rng.js';
import './data/buffs.js';
import './data/enchants.js';
import './data/levelstats.js';
import './data/spells.js';
import './data/talents.js';
