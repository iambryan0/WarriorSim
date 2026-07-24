// Entry for index.html (Season of Discovery).
import { gear } from './data/gear_sod.ts';
import { runes } from './data/runes.ts';
import { session } from './data/session_sod.ts';
import { installModeData } from './data/mode.ts';
import './main.ts';

installModeData({ mode: 'sod', gear, runes, session });
