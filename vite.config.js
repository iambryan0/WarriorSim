import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));

// Interim until the ES-module conversion: the engine/UI files are classic
// global-scope scripts loaded via ordered <script> tags (and importScripts in
// the worker), so Vite cannot put them in the module graph yet. Ship them
// verbatim alongside the bundled output.
const copyLegacyJs = () => ({
    name: 'copy-legacy-js',
    closeBundle() {
        fs.cpSync(resolve(root, 'js'), resolve(root, 'dist/js'), { recursive: true });
    },
});

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
    plugins: [copyLegacyJs()],
});
