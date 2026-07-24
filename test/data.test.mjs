// Schema validation for the static data tables (PROMPT.MD Phase 2 step 1).
// Every entry in every table is parsed against js/data/schemas.ts. Known
// anomalies live in test/data-anomalies.json (and are explained in
// NOTES.md); anything NEW fails here, so data edits keep the tables honest.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buffSchema,
    enchantSchema,
    itemSchema,
    levelStatsRowSchema,
    runeSchema,
    setSchema,
    talentTreeSchema,
} from '../js/data/schemas.ts';
import { buffs } from '../js/data/buffs.ts';
import { enchant, sets } from '../js/data/enchants.ts';
import { gear } from '../js/data/gear.ts';
import { gear as gearSod } from '../js/data/gear_sod.ts';
import { levelstats } from '../js/data/levelstats.ts';
import { runes } from '../js/data/runes.ts';
import { talents } from '../js/data/talents.ts';

const anomalies = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'data-anomalies.json'), 'utf8'));

function violations(schema, entries, label) {
    const out = [];
    for (const [i, entry] of entries.entries()) {
        const res = schema.safeParse(entry);
        if (res.success) continue;
        for (const issue of res.error.issues) {
            out.push({
                table: label,
                id: entry?.id ?? i,
                name: entry?.name,
                path: issue.path.join('.'),
                issue: issue.message,
            });
        }
    }
    return out;
}

const flat = (table) => Object.values(table).flat();

describe('data tables validate against their schemas', () => {
    const cases = [
        ['buffs', buffSchema, buffs],
        ['enchant', enchantSchema, flat(enchant)],
        ['sets', setSchema, sets],
        ['gear', itemSchema, flat(gear)],
        ['gear_sod', itemSchema, flat(gearSod)],
        ['levelstats', levelStatsRowSchema, levelstats],
        ['runes', runeSchema, flat(runes)],
        ['talents', talentTreeSchema, talents],
    ];

    for (const [label, schema, entries] of cases) {
        it(`${label} (${entries.length} entries)`, () => {
            const found = violations(schema, entries, label);
            const known = anomalies.filter((a) => a.table === label);
            // Every found violation must be a known anomaly, and every known
            // anomaly must still exist (stale entries get cleaned up).
            expect(found).toEqual(known);
        });
    }
});
