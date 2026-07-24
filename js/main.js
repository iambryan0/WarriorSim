// Shared Vite entry: stylesheet, engine modules, and the mode-independent
// data tables. Mode-specific data is installed by the per-page entries
// main-sod.js / main-classic.js. The UI files (ui.js, settings.js,
// profiles.js, stats.js) are still ordered classic <script> tags and reach
// the engine through its interim globalThis shims (see MIGRATION.md).
import '../scss/style.scss';
import './rng.js';
import './data/buffs.js';
import './data/enchants.js';
import './data/levelstats.js';
import './data/spells.js';
import './data/talents.js';
import './classes/simulation.js';
import './classes/spell.js';
import './classes/weapon.js';
import './classes/player.js';
import './globals.js';
