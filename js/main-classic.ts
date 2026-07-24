// Entry for classic.html (era).
import { gear } from './data/gear.ts';
import { session } from './data/session.ts';
import { installModeData } from './data/mode.ts';
import './main.ts';

installModeData({ mode: 'classic', gear, session });
