// Core engine interfaces (PROMPT.MD Phase 1 step 4). These describe the
// shapes that cross module boundaries: the worker message protocol, the
// config objects built from the DOM (or passed headless), and the result
// report. The sprawling per-instance stat fields on Player/Spell/Aura remain
// index-signature-loose until the Phase 2 strictification.

export interface TargetConfig {
    level: number;
    basearmor: number;
    defense: number;
    resistance: number;
    speed: number;
    mindmg: number;
    maxdmg: number;
    /** String in storage; the engine relies on loose numeric coercion. */
    bleedreduction: number | string;
}

export interface PlayerConfig {
    /** String in storage; the engine relies on loose numeric coercion. */
    level: number | string;
    race: string;
    /** 'sod' | 'classic'; can be undefined on the DOM path before mode.ts installs. */
    aqbooks: boolean;
    reactionmin: number;
    reactionmax: number;
    adjacent: number;
    mode: string | undefined;
    spellqueueing: boolean;
    logging?: boolean;
    target: TargetConfig;
    /** DOM-built configs carry extra UI-only fields; tightened in Phase 2. */
    [key: string]: any;
}

export interface SimConfig {
    timesecsmin: number;
    timesecsmax: number;
    executeperc: number;
    startrage: number;
    iterations: number;
    batching: number;
}

/** Aggregate report posted by the worker / built by Simulation. */
export interface SimResult {
    iterations: number;
    totaldmg: number;
    totalduration: number;
    mindps: number;
    maxdps: number;
    sumdps: number;
    sumdps2: number;
    starttime?: number;
    endtime?: number;
    /** Present on fullReport runs: Player.serializeStats() + dps spread. */
    player?: any;
    spread?: Record<number, number>;
    [key: string]: any;
}

/** Item / enchant / set-bonus proc definition from the data tables. */
export interface ProcDef {
    /** Absent on PPM-based and unconditional procs. */
    chance?: number;
    ppm?: number;
    extra?: number;
    magicdmg?: number;
    physdmg?: number;
    cooldown?: number;
    spell?: any;
    [key: string]: any;
}

/** Message sent to js/sim-worker.ts. */
export interface WorkerParams {
    /** Filled in by SimulationWorker.start() before posting. */
    globals?: any;
    /** Player constructor args: [testItem, testType, enchtype, PlayerConfig]. */
    player: any[];
    sim: SimConfig;
    fullReport?: boolean;
    /** Deterministic runs only (parity checks, Phase 3 validation). */
    seed?: number;
}

export type FinishedCallback = (report: SimResult) => void;
export type UpdateCallback = (iteration: number, report: SimResult) => void;
export type ErrorCallback = (...args: any[]) => void;
