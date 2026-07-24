import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist/',
            'public/',
            'gear/',
            'old/',
            // Static data tables (~95k lines) — validated by schema in
            // Phase 2 instead of linted.
            'js/data/buffs.ts',
            'js/data/enchants.ts',
            'js/data/gear.ts',
            'js/data/gear_sod.ts',
            'js/data/levelstats.ts',
            'js/data/presets.ts',
            'js/data/runes.ts',
            'js/data/session.ts',
            'js/data/session_sod.ts',
            'js/data/spells.ts',
            'js/data/talents.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                // Vendored classic scripts (public/libs) + page globals; see
                // js/vendor-globals.d.ts.
                $: 'readonly',
                Chart: 'readonly',
                mode: 'readonly',
                whTooltips: 'writable',
                localStorage: 'readonly',
                navigator: 'readonly',
                document: 'readonly',
                window: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                Worker: 'readonly',
                postMessage: 'readonly',
                onmessage: 'writable',
                globalThis: 'readonly',
                URL: 'readonly',
            },
        },
        rules: {
            // The engine/UI are deliberately loose until Phase 2 typing.
            '@typescript-eslint/no-explicit-any': 'off',
            // var view = this; — the codebase's pervasive jQuery-era idiom.
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'prefer-const': 'off',
            'no-var': 'off',
            // Legacy-style noise, deliberately kept until the typing pass:
            // dense one-line `if (x) {}` blocks and hasOwnProperty calls.
            'no-empty': 'off',
            'no-prototype-builtins': 'off',
            // Flow-analysis rule that flags legacy assign-then-overwrite
            // patterns in the engine; rewriting them is not worth the churn.
            'no-useless-assignment': 'off',
        },
    },
    {
        files: ['test/**', 'vite.config.js', 'eslint.config.js'],
        languageOptions: {
            globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', structuredClone: 'readonly' },
        },
    },
);
