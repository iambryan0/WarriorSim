// Mode-specific data tables. The old build picked them by script tag
// (index.html loaded gear_sod.js + runes.js, classic.html loaded gear.js);
// now the page entries and the worker install the right tables here before
// the engine runs, and engine modules import these live bindings. `runes`
// stays undefined in classic mode — the engine's `typeof runes` guards keep
// working unchanged.
export let gear;
export let runes;

export function installModeData(tables) {
    gear = tables.gear;
    runes = tables.runes;
    // Interim ESM-migration shim: classic scripts still reference these by
    // bare global name; removed once every consumer imports explicitly.
    Object.assign(globalThis, { gear, runes });
}
