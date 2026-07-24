// Shared Vite entry: stylesheet, UI modules (which pull the whole engine
// through their imports), and the page bootstrap that the old inline
// $(document).ready() script tag used to do. jQuery, tablesorter and Chart
// remain vendored classic scripts in public/libs — they run before any
// module and are reached as globals.
import '../scss/style.scss';
import { SIM } from './sim-ns.js';
import './ui.js';
import './settings.js';
import './stats.js';
import './profiles.js';

$(document).ready(function () {
    SIM.UI.init();
    SIM.SETTINGS.init();
    SIM.STATS.init();
    SIM.PROFILES.init();
});
