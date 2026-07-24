// Ambient declarations for the vendored classic scripts in public/libs
// (loaded via plain <script> tags before any module) and the page-level
// globals. The UI stays loosely typed on purpose — see PROMPT.MD ("leave the
// UI code loosely typed for now").
declare const $: any;
declare const Chart: any;
declare var mode: string | undefined;
declare var whTooltips: any;

// Vite resolves stylesheet imports from entry modules.
declare module "*.scss";
