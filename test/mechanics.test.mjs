// Unit tests for isolated combat mechanics (PROMPT.MD Phase 2 step 3), each
// asserting the engine against the known Classic formula with its source
// cited. The engine is loaded once (SoD mode, thbwl fixture globals — a
// level-60 2H fury build); players are constructed per test with controlled
// target configs.
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadEngine, ROOT } from './headless/sandbox.mjs';

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/thbwl.json'), 'utf8'));

let engine; // { RNG, updateGlobals, Player, Simulation }
let RESULT;
let Weapon;

beforeAll(async () => {
    engine = await loadEngine({ sod: true });
    ({ RESULT } = await import(path.join(ROOT, 'js/classes/simulation.ts')));
    ({ Weapon } = await import(path.join(ROOT, 'js/classes/weapon.ts')));
    engine.updateGlobals(fixture.globals);
});

// Build a player against a target with the given defense/level; other config
// comes from the fixture (logging off to keep console quiet).
function makePlayer({ defense, level = 63 } = {}) {
    const cfg = structuredClone(fixture.playerConfig);
    cfg.logging = false;
    cfg.target.level = level;
    if (defense !== undefined) cfg.target.defense = defense;
    else cfg.target.defense = level * 5;
    return new engine.Player(undefined, undefined, undefined, cfg);
}

const skillOf = (p) => p.stats['skill_' + p.mh.type];

describe('attack table vs weapon-skill delta (defense - skill = 0/5/10/15)', () => {
    // Formulas: WoWWiki-archive "Weapon skill" / "Attack table" (vanilla),
    // corroborated by Magey's attack-table dissection:
    //   miss  = 5% + 0.1%/point (delta <= 10), 5% + 0.2%/point (delta > 10),
    //           and +hit loses 1% effectiveness when delta > 10
    //   dodge = 5% + 0.1%/point (minus expertise, SoD)
    //   glancing chance = 10% + 2%/point of (defense - min(skill, 5*level))
    for (const delta of [0, 5, 10, 15]) {
        it(`delta ${delta}`, () => {
            const probe = makePlayer({});
            const skill = skillOf(probe);
            const p = makePlayer({ defense: skill + delta });
            const hit = p.stats.hit;
            const expectedMiss = 5 + (delta > 10 ? delta * 0.2 : delta * 0.1) - (delta > 10 ? hit - 1 : hit);
            expect(p.getMissChance(p.mh)).toBeCloseTo(expectedMiss, 10);
            expect(p.getDodgeChance(p.mh)).toBeCloseTo(
                Math.max(5 - p.stats.expertise - p.dodgetimeworn - p.target.dodge + delta * 0.1, 0),
                10,
            );
            const capped = Math.max(skill + delta - Math.min(skill, p.level * 5), 0);
            expect(p.getGlanceChance(p.mh)).toBeCloseTo(10 + capped * 2, 10);
        });
    }

    it('dual-wield miss = miss * 0.8 + 20 (WoWWiki "Dual wield": ~24% baseline)', () => {
        const probe = makePlayer({});
        const skill = skillOf(probe);
        const p = makePlayer({ defense: skill + 15 });
        const hit = p.stats.hit;
        const base = 5 + 15 * 0.2;
        expect(p.getDWMissChance(p.mh)).toBeCloseTo(base * 0.8 + 20 - (hit - 1), 10);
    });

    it('glancing damage reduction stays in the clamped low/high band and is seed-deterministic', () => {
        // WoWWiki "Glancing blow": low = 1.3 - 0.05*delta (clamped 0.01..0.91),
        // high = 1.2 - 0.03*delta (clamped 0.2..0.99); vs a +3 boss (delta 15
        // at cap) the band is [0.55, 0.75].
        const probe = makePlayer({});
        const skill = skillOf(probe);
        const p = makePlayer({ defense: skill + 15 });
        const low = Math.max(Math.min(1.3 - 0.05 * 15, 0.91), 0.01);
        const high = Math.max(Math.min(1.2 - 0.03 * 15, 0.99), 0.2);
        expect(low).toBeCloseTo(0.55, 10);
        expect(high).toBeCloseTo(0.75, 10);
        // First mulberry32(42) draw is 0.6011037519201636 (js/rng.ts).
        engine.RNG.seed(42);
        expect(p.getGlanceReduction(p.mh)).toBeCloseTo(0.6011037519201636 * (high - low) + low, 12);
        for (let i = 0; i < 200; i++) {
            const r = p.getGlanceReduction(p.mh);
            expect(r).toBeGreaterThanOrEqual(low);
            expect(r).toBeLessThanOrEqual(high);
        }
    });

    it('crit is suppressed 1%/level plus 1.8% aura-crit cap vs +3 targets (Magey, "crit cap")', () => {
        const at = (level) => {
            const p = makePlayer({ level });
            return p.getCritChance() - (p.stats.crit + (p.talents.crit || 0));
        };
        expect(at(60) - at(60)).toBe(0);
        expect(at(62)).toBeCloseTo(-2, 10); // 2 levels: -1%/level
        expect(at(63)).toBeCloseTo(-3 - 1.8, 10); // +3: -1%/level and -1.8%
    });
});

describe('rage generation (Blizzard rage formula, patch 1.x)', () => {
    // Rage from damage dealt = damage / RageConversion * 7.5, with
    // RageConversion = 0.0091107836*L^2 + 3.225598133*L + 4.2652911
    // (Kalgan-era forum post; see also WoWWiki "Rage"). At 60 that is ~230.6.
    it('rage conversion constant at level 60', () => {
        const p = makePlayer({});
        expect(p.rageconversion).toBeCloseTo(0.0091107836 * 3600 + 3.225598133 * 60 + 4.2652911, 6);
        expect(p.rageconversion).toBeCloseTo(230.6, 1);
    });

    it('white hit generates dmg / conversion * 7.5 * ragemod', () => {
        const p = makePlayer({});
        p.talents.umbridledwrath = 0;
        p.extrarage = 0; // the fixture build carries flat rage-per-hit bonuses;
        p.extracritrage = 0; // zeroed to isolate the base formula
        p.rage = 0;
        p.addRage(100, RESULT.HIT, p.mh, null);
        expect(p.rage).toBeCloseTo((100 / p.rageconversion) * 7.5 * p.ragemod, 10);
    });

    it('a dodged swing still grants 75% of the average-damage rage', () => {
        // 1.8 changelog: "dodged/parried attacks now generate 75% of the rage
        // they would have" — engine uses the average white hit as the basis.
        const p = makePlayer({});
        p.talents.umbridledwrath = 0;
        p.rage = 0;
        p.addRage(0, RESULT.DODGE, p.mh, null);
        expect(p.rage).toBeCloseTo((p.mh.avgdmg() / p.rageconversion) * 7.5 * 0.75, 10);
    });

    it('rage is hard-capped at 100', () => {
        const p = makePlayer({});
        p.talents.umbridledwrath = 0;
        p.rage = 99;
        p.addRage(100000, RESULT.HIT, p.mh, null);
        expect(p.rage).toBe(100);
    });
});

describe('proc rates: PPM converts through weapon speed, fixed chance does not', () => {
    // PPM procs: chance per swing = ppm * speed / 60 (WoWWiki "Procs Per
    // Minute"). The engine stores chances as x/10000: ~~(speed * ppm / 0.006).
    it('a 1.6 PPM enchant on a 2.4-speed weapon is a 6.4% swing chance', () => {
        const p = makePlayer({});
        const stub = { id: 1, name: 'Stub Mace', type: 'Mace', speed: 2.4, mindmg: 100, maxdmg: 200 };
        const w = new Weapon(p, stub, { ppm: 1.6, magicdmg: 1 });
        expect(w.proc2.chance).toBe(Math.floor((2.4 * 1.6) / 0.006));
        expect(w.proc2.chance / 10000).toBeCloseTo((1.6 * 2.4) / 60, 3);
    });

    it('a fixed-chance enchant ignores weapon speed', () => {
        const p = makePlayer({});
        const fast = new Weapon(
            p,
            { id: 1, name: 'Fast', type: 'Mace', speed: 1.5, mindmg: 1, maxdmg: 2 },
            { chance: 15, magicdmg: 1 },
        );
        const slow = new Weapon(
            p,
            { id: 2, name: 'Slow', type: 'Mace', speed: 3.8, mindmg: 1, maxdmg: 2 },
            { chance: 15, magicdmg: 1 },
        );
        expect(fast.proc2.chance).toBe(slow.proc2.chance);
        expect(fast.proc2.chance).toBe(15 * 100); // x/10000 units
    });
});

describe('Flurry', () => {
    // Talent: 5 ranks, 10/15/20/25/30% haste after a critical hit, consumed
    // over the next 3 swings (WoWWiki "Flurry"; talents.ts aura fn
    // 5 + rank*5).
    it('haste bonus matches rank table and charges work 3-down', () => {
        const p = makePlayer({});
        expect(p.talents.flurry).toBe(5 + 5 * 5); // fixture build is 5/5
        expect(p.auras.flurry.mult_stats.haste).toBe(p.talents.flurry);
        const f = p.auras.flurry;
        f.use();
        expect(f.stacks).toBe(3);
        expect(f.timer).toBe(1);
        f.proc();
        f.proc();
        expect(f.timer).toBe(1);
        f.proc();
        expect(f.stacks).toBe(0);
        expect(f.timer).toBe(0); // expired after three swings
    });
});

describe('Heroic Strike on-next-swing queue', () => {
    it('a queued HS converts the next mainhand swing and spends its rage cost', () => {
        const p = makePlayer({});
        p.talents.umbridledwrath = 0;
        // Force a guaranteed connect so no refund path muddies the assert.
        p.mh.miss = 0;
        p.mh.dwmiss = 0;
        p.mh.dodge = 0;
        p.mh.glanceChance = 0;
        engine.RNG.seed(42);
        p.extrarage = 0;
        p.extracritrage = 0;
        p.rage = 50;
        p.nextswinghs = true;
        const cost = p.spells.heroicstrike.cost;
        expect(cost).toBe(15 - p.talents.impheroicstrike - p.ragecostbonus); // spell.ts HeroicStrike; 3/3 imp HS = 12
        p.attackmh(p.mh);
        expect(p.nextswinghs).toBe(false); // queue consumed
        expect(p.rage).toBeCloseTo(50 - cost, 10); // cost paid, no white-hit rage for special attacks
    });

    it('an unqueued swing keeps generating white rage instead', () => {
        const p = makePlayer({});
        p.talents.umbridledwrath = 0;
        p.mh.miss = 0;
        p.mh.dwmiss = 0;
        p.mh.dodge = 0;
        p.mh.glanceChance = 0;
        p.crit = 0;
        p.mh.crit = 0;
        engine.RNG.seed(42);
        p.rage = 0;
        p.nextswinghs = false;
        const dmg = p.attackmh(p.mh);
        expect(p.rage).toBeGreaterThan(0);
        void dmg;
    });
});
