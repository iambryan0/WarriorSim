// Zod schemas for the static data tables (PROMPT.MD Phase 2 step 1). The
// schemas describe the tables' INTENDED shape — every entry is validated in
// test/data.test.mjs, and any mismatch is either a real data bug (tracked in
// test/data-anomalies.json + NOTES.md) or a schema gap to fix here.
//
// Conventions the data genuinely uses (not bugs, so the schemas allow them):
// - `q` (quality), `i` (ilvl), `ench` ids and proc `interval`/`duration` are
//   numeric STRINGS; the engine/UI rely on loose coercion.
// - `phase` is number-or-numeric-string, mixed freely (normalization
//   candidate for the Phase 2 codegen, logged in NOTES.md).
// - gear ids are either a number or "itemid|suffixid" for random-suffix
//   items (2406 of them in gear_sod; ui.ts splits on '|').
import { z } from 'zod';

const numericString = z.string().regex(/^\d+(\.\d+)?$/);
const phase = z.union([z.number().int(), numericString]);
// Number, "itemid|suffixid" (random-suffix), or a letter-suffixed variant
// id like "213319a" (same item modeled twice, e.g. with/without its AP proc;
// ui.ts strips the suffix for tooltips).
const itemId = z.union([z.number().int(), z.string().regex(/^\d+\|\d+$/), z.string().regex(/^\d+[a-z]$/)]);

/** Magic-school resistance map, e.g. { fire: 35, shadow: 15 }. */
const resist = z.partialRecord(z.enum(['fire', 'frost', 'nature', 'shadow', 'arcane', 'holy']), z.number());

export const procSchema = z.strictObject({
    chance: z.number().optional(),
    ppm: z.number().optional(),
    dmg: z.number().optional(),
    magic: z.boolean().optional(),
    bleed: z.boolean().optional(),
    binaryspell: z.boolean().optional(),
    procgcd: z.boolean().optional(),
    tick: z.number().optional(),
    interval: numericString.optional(),
    duration: numericString.optional(),
    cooldown: z.number().optional(),
    extra: z.number().int().optional(),
    coeff: z.number().optional(),
    spell: z.string().optional(),
});

const itemStats = {
    str: z.number().optional(),
    agi: z.number().optional(),
    sta: z.number().optional(),
    int: z.number().optional(),
    ap: z.number().optional(),
    crit: z.number().optional(),
    hit: z.number().optional(),
    dodge: z.number().optional(),
    parry: z.number().optional(),
    defense: z.number().optional(),
    block: z.number().optional(),
    haste: z.number().optional(),
    expertise: z.number().optional(),
    resist: resist.optional(),
};

export const itemSchema = z.strictObject({
    id: itemId,
    name: z.string(),
    ...itemStats,
    q: numericString.optional(),
    i: numericString.optional(),
    r: z.number().int().optional(),
    p: z.string().optional(),
    slot: z.string().optional(),
    type: z.string().optional(),
    source: z.string().optional(),
    subsource: z.string().optional(),
    phase: phase.optional(),
    ac: z.number().optional(),
    d: z.number().optional(),
    mindmg: z.number().optional(),
    maxdmg: z.number().optional(),
    speed: z.number().optional(),
    proc: procSchema.optional(),
    /** Weapon-skill bonuses keyed by numeric skill id. */
    skills: z.record(numericString, z.number()).optional(),
    skill: z.number().optional(),
    skill_0: z.number().optional(),
    skill_1: z.number().optional(),
    skill_2: z.number().optional(),
    skill_3: z.number().optional(),
    skill_4: z.number().optional(),
    skill_5: z.number().optional(),
    /** Random-suffix id for the suffix picker (pairs with "id|suffix"). */
    rand: z.number().int().optional(),
    /** Timeworn (SoD) flag. */
    tw: z.boolean().optional(),
    offhand: z.boolean().optional(),
    /**
     * Dead upstream field on 26 classic weapons (capitalized; nothing in the
     * engine or UI ever reads it). Kept accepted to stay diffable against
     * upstream — see NOTES.md.
     */
    Mainhand: z.boolean().optional(),
});

export const buffSchema = z.strictObject({
    id: z.number().int(),
    name: z.string(),
    iconname: z.string(),
    group: z.string().optional(),
    stance: z.string().optional(),
    minlevel: z.number().int().optional(),
    maxlevel: z.number().int().optional(),
    spellid: z.boolean().optional(),
    other: z.boolean().optional(),
    sod: z.boolean().optional(),
    aq: z.boolean().optional(),
    worldbuff: z.boolean().optional(),
    consume: z.boolean().optional(),
    skill: z.boolean().optional(),
    rune: z.boolean().optional(),
    mrp: z.boolean().optional(),
    fra: z.boolean().optional(),
    voodoofrenzy: z.boolean().optional(),
    improvedexposed: z.boolean().optional(),
    // Stat contributions. `armor` is the amount subtracted from the
    // target's armor (Sunder/Expose/Faerie Fire family).
    armor: z.number().optional(),
    armorperlevel: z.number().optional(),
    ap: z.number().optional(),
    apsod: z.number().optional(),
    wfap: z.number().optional(),
    wfapperc: z.number().optional(),
    str: z.number().optional(),
    agi: z.number().optional(),
    int: z.number().optional(),
    sta: z.number().optional(),
    crit: z.number().optional(),
    spellcrit: z.number().optional(),
    haste: z.number().optional(),
    hit: z.number().optional(),
    dodge: z.number().optional(),
    defense: z.number().optional(),
    dmgmod: z.number().optional(),
    spelldmgmod: z.number().optional(),
    moddmgtaken: z.number().optional(),
    moddmgdone: z.number().optional(),
    dmgshield: z.number().optional(),
    strmod: z.number().optional(),
    agimod: z.number().optional(),
    stamod: z.number().optional(),
    motwmod: z.number().optional(),
    mightmod: z.number().optional(),
    bleedmod: z.number().optional(),
    skill_0: z.number().optional(),
    skill_1: z.number().optional(),
    skill_2: z.number().optional(),
    skill_3: z.number().optional(),
    skill_4: z.number().optional(),
    skill_5: z.number().optional(),
    skill_6: z.number().optional(),
    skill_7: z.number().optional(),
    resist: resist.optional(),
});

export const enchantSchema = z.strictObject({
    id: z.number().int(),
    name: z.string(),
    /** Wowhead enchantment id, numeric string. */
    ench: numericString.optional(),
    r: z.number().int().optional(),
    spellid: z.boolean().optional(),
    phase: phase.optional(),
    temp: z.boolean().optional(),
    bonusdmg: z.number().optional(),
    magicdmg: z.number().optional(),
    ppm: z.number().optional(),
    chance: z.number().optional(),
    procspell: z.string().optional(),
    source: z.string().optional(),
    subsource: z.string().optional(),
    str: z.number().optional(),
    agi: z.number().optional(),
    sta: z.number().optional(),
    ap: z.number().optional(),
    crit: z.number().optional(),
    haste: z.number().optional(),
    hit: z.number().optional(),
    defense: z.number().optional(),
    block: z.number().optional(),
    resist: resist.optional(),
});

export const setSchema = z.strictObject({
    id: z.number().int(),
    name: z.string(),
    items: z.array(z.number().int()),
    bonus: z.array(
        z.strictObject({
            count: z.number().int(),
            /**
             * Applied via Player set-bonus handling: numeric stats, boolean
             * engine hooks (e.g. enhancedbs, switchbonus), procspell class
             * names, or a nested resist map.
             */
            stats: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), resist])),
        }),
    ),
});

export const runeSchema = z.strictObject({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    iconname: z.string(),
    /** Rune id this one requires (UI gating). */
    enable: z.number().int().optional(),
    buffgroup: z.string().optional(),
    // Engine flags/values, one per rune.
    flagellation: z.boolean().optional(),
    bloodfrenzy: z.boolean().optional(),
    furiousthunder: z.boolean().optional(),
    devastate: z.boolean().optional(),
    singleminded: z.boolean().optional(),
    twohandonly: z.boolean().optional(),
    bloodsurge: z.boolean().optional(),
    focusedrage: z.boolean().optional(),
    precisetiming: z.boolean().optional(),
    gladstance: z.boolean().optional(),
    swordboard: z.boolean().optional(),
    wreckingcrew: z.boolean().optional(),
    tasteforblood: z.boolean().optional(),
    freshmeat: z.boolean().optional(),
    suddendeath: z.boolean().optional(),
    haste2h: z.number().optional(),
    dmgshield: z.number().optional(),
    ragemod: z.number().optional(),
});

export const talentSchema = z.strictObject({
    i: z.number().int(),
    n: z.string(),
    /** Max rank. */
    m: z.number().int(),
    /** Spell id per rank. */
    s: z.array(z.number().int()),
    /** Extra description numbers per rank (UI). */
    d: z.array(z.any()),
    x: z.number().int(),
    y: z.number().int(),
    iconname: z.string(),
    /** Current rank (mutated at runtime by updateGlobals). */
    c: z.number().int(),
    aura: z.custom<(count: number) => Record<string, number>>((v) => typeof v === 'function'),
    /** Required talent rows (UI arrows). */
    r: z.array(z.number()).optional(),
    enable: z.union([z.string(), z.number()]).optional(),
});

export const talentTreeSchema = z.strictObject({
    n: z.string(),
    t: z.array(talentSchema),
});

/** Level-stats rows are raw CSV strings, split by the engine on use. */
export const levelStatsRowSchema = z.string().regex(/^[\d.,]+$/);

/**
 * Runtime selection state the UI/engine stamp onto table entries in place
 * (updateGlobals, gear pickers). Not part of the on-disk data — the schemas
 * above stay pure — but part of the entries' runtime type.
 */
interface Selectable {
    selected?: boolean;
    hidden?: boolean;
    /** Number from the engine, formatted string from the item-table UI. */
    dps?: number | string;
}

export type Item = z.infer<typeof itemSchema> & Selectable;
export type Buff = z.infer<typeof buffSchema> & { active?: boolean };
export type Enchant = z.infer<typeof enchantSchema> & Selectable;
// Set-bonus stats stay strictly validated, but consuming code treats the
// values by known key (procspell string, numeric stats, boolean hooks) —
// typed loose here until the engine reads them through a typed accessor.
export type ItemSet = Omit<z.infer<typeof setSchema>, 'bonus'> & {
    bonus: { count: number; stats: Record<string, any> }[];
};
export type Rune = z.infer<typeof runeSchema> & Selectable;
export type TalentTree = z.infer<typeof talentTreeSchema>;
export type Proc = z.infer<typeof procSchema>;
