// Entry for index.html (Season of Discovery).
import './main.js';
import { gear } from './data/gear_sod.js';
import { runes } from './data/runes.js';
import { installModeData } from './data/mode.js';
import './data/session_sod.js';
import './data/presets.js';

installModeData({ gear, runes });
