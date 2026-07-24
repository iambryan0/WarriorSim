// Generates test/fixtures/*.json from the shipped presets in js/data/presets.js.
//
// A fixture is exactly the worker's input: a `globals` object consumed by
// updateGlobals(), plus playerConfig/simConfig objects mirroring what
// Player.getConfig()/Simulation.getConfig() read from the DOM. The preset ->
// storage merge below replicates SIM.PROFILES.importProfile (js/profiles.js)
// on top of the `session` defaults (js/data/session_sod.js); the globals shape
// matches what SIM.UI.loadSession() passes to updateGlobals(). updateGlobals
// first clears every selected flag, so this storage-shaped delta selects the
// same items as the browser's full getGlobalsDelta() payload.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createEngineContext, ROOT } from './sandbox.mjs';

const ctx = await createEngineContext({ sod: true, extraScripts: ['js/data/session_sod.js'] });
const session = JSON.parse(vm.runInContext('JSON.stringify(session)', ctx));
const spellsData = JSON.parse(vm.runInContext('JSON.stringify(spells)', ctx));

const presetsSrc = fs.readFileSync(path.join(ROOT, 'js/data/presets.js'), 'utf8');
const presets = {};
for (const [, name, b64] of presetsSrc.matchAll(/^var preset_(\w+) = '([^']+)';/gm)) {
    presets[name] = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

// Mirrors importProfile(): scalar strings copied, buffs/talents replaced,
// gear/runes replaced with single selected entries, enchants as selected
// lists, rotation merged by id (matched entries become active and take the
// preset's overrides, unmatched entries are deactivated).
function applyPreset(minified) {
    const storage = structuredClone(session);
    for (const prop in minified) {
        if (typeof minified[prop] === 'string') storage[prop] = minified[prop];
    }
    storage.buffs = minified.buffs;
    storage.talents = minified.talents;
    storage.gear = {};
    for (const type in minified.gear) {
        if (type === 'custom') continue;
        storage.gear[type] = [{ id: minified.gear[type], selected: true }];
    }
    for (const spell of spellsData) {
        if (!storage.rotation.some((s) => s.id === spell.id)) storage.rotation.push(structuredClone(spell));
    }
    for (const spell of storage.rotation) {
        const newspell = minified.rotation.find((s) => s.id === spell.id);
        if (newspell) {
            spell.active = true;
            for (const prop in newspell) if (prop !== 'id') spell[prop] = newspell[prop];
        } else {
            spell.active = false;
        }
    }
    storage.runes = {};
    for (const type in minified.runes) {
        storage.runes[type] = [{ id: minified.runes[type], selected: true }];
    }
    storage.enchant = {};
    for (const type in minified.enchant) {
        storage.enchant[type] = minified.enchant[type].map((id) => ({ id, selected: true }));
    }
    return storage;
}

// Mirrors Player.getConfig() / Simulation.getConfig() field-for-field,
// including which values stay strings (level, race, bleedreduction) — the
// engine relies on loose coercion of those.
function buildConfigs(storage, iterations) {
    return {
        playerConfig: {
            level: storage.level,
            race: storage.race,
            aqbooks: storage.aqbooks === 'Yes',
            reactionmin: parseInt(storage.reactionmin),
            reactionmax: parseInt(storage.reactionmax),
            adjacent: parseInt(storage.adjacent),
            mode: 'sod',
            spellqueueing: storage.spellqueueing === 'Yes',
            logging: true,
            target: {
                level: parseInt(storage.targetlevel),
                basearmor: parseInt(storage.targetbasearmor || storage.targetcustomarmor),
                defense: parseInt(storage.targetlevel) * 5,
                resistance: parseInt(storage.targetresistance),
                speed: parseFloat(storage.targetspeed) * 1000,
                mindmg: parseInt(storage.targetmindmg),
                maxdmg: parseInt(storage.targetmaxdmg),
                bleedreduction: storage.bleedreduction,
            },
        },
        simConfig: {
            timesecsmin: parseInt(storage.timesecsmin),
            timesecsmax: parseInt(storage.timesecsmax),
            executeperc: parseInt(storage.executeperc),
            startrage: parseInt(storage.startrage),
            iterations,
            batching: parseInt(storage.batching),
        },
    };
}

// name, base preset, storage-field overrides, optional storage mutator.
// Variations are chosen so each actually exercises its path with that
// preset's rotation: Execute (20662) is only in the BWL 2H rotation, adjacent
// targets need Whirlwind (1680, in the AQ DW rotation), spell queueing only
// matters with nonzero reaction time (BWL presets), and Windfury/batching
// needs the totem buff added.
const FIXTURES = [
    ['thbwl', 'thbwl', {}],
    ['dwbwl', 'dwbwl', {}],
    ['thaq', 'thaq', {}],
    ['dwaq', 'dwaq', {}],
    ['thaq-short', 'thaq', { timesecsmin: '20', timesecsmax: '20', executeperc: '30' }],
    ['thbwl-execute', 'thbwl', { executeperc: '40' }],
    ['dwbwl-tanking', 'dwbwl', { targetspeed: '2.0' }],
    ['dwaq-adjacent', 'dwaq', { adjacent: '2' }],
    ['thbwl-noqueue', 'thbwl', { spellqueueing: 'No' }],
    ['thbwl-long-startrage', 'thbwl', { timesecsmin: '120', timesecsmax: '180', startrage: '80' }],
    ['dwbwl-orc-windfury', 'dwbwl', { race: 'Orc' }, (s) => s.buffs.push('10614')],
];
const ITERATIONS = 100;

const outDir = path.join(ROOT, 'test/fixtures');
for (const [name, presetName, overrides, mutate] of FIXTURES) {
    const storage = Object.assign(applyPreset(presets[presetName]), overrides);
    if (mutate) mutate(storage);
    const fixture = {
        name,
        seed: 42,
        ...buildConfigs(storage, ITERATIONS),
        globals: {
            talents: storage.talents,
            buffs: storage.buffs,
            rotation: storage.rotation,
            gear: storage.gear,
            enchant: storage.enchant,
            runes: storage.runes,
            sod: true,
        },
    };
    const file = path.join(outDir, name + '.json');
    fs.writeFileSync(file, JSON.stringify(fixture, null, 2) + '\n');
    console.error(`wrote ${path.relative(ROOT, file)} (${storage.profilename})`);
}
