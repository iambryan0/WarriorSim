import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        // The engine defaults aura/spell display names to constructor.name
        // (spell.js Spell/Aura constructors) — class names must survive
        // minification.
        rollupOptions: {
            output: { keepNames: true },
            input: {
                sod: resolve(root, 'index.html'),
                classic: resolve(root, 'classic.html'),
            },
        },
    },
    // Workers are built by a separate pipeline — keepNames must be set here
    // too or the worker's engine copy gets its class names mangled.
    worker: {
        rollupOptions: { output: { keepNames: true } },
    },
});
