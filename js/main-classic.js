// Entry for classic.html (era).
import { gear } from './data/gear.js';
import { session } from './data/session.js';
import { installModeData } from './data/mode.js';
import './main.js';

installModeData({ mode: 'classic', gear, session });
