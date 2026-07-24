// Mode-specific state. The old build picked data tables by script tag
// (index.html loaded gear_sod.js + runes.js + session_sod.js, classic.html
// loaded gear.js + session.js) and set `var mode` inline; now the page
// entries and the worker install everything here before the engine or UI
// runs, and consumers import these live bindings. `runes` stays undefined in
// classic mode — the engine's `typeof runes` guards keep working unchanged.
export let mode;
export let gear;
export let runes;
export let session;

export function installModeData(tables) {
    mode = tables.mode;
    gear = tables.gear;
    runes = tables.runes;
    session = tables.session;
    // The engine reads globalThis.mode when building a config from the DOM
    // (Player.getConfig).
    if (mode !== undefined) globalThis.mode = mode;
}
