// Entry for index.html (Season of Discovery).
import { gear } from './data/gear_sod.js';
import { runes } from './data/runes.js';
import { session } from './data/session_sod.js';
import { installModeData } from './data/mode.js';
import './main.js';

installModeData({ mode: 'sod', gear, runes, session });
