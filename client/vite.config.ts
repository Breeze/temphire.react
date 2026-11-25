/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite builds and serves the app; Vitest, which reads this same file, runs the tests.
 *
 * Successor of `angular.json`: the dev server (`ng serve` on 4200 becomes `vite` on 5173, the
 * origin the server allows in `AllowedClientOrigins`), the production build, and the unit-test
 * builder.  There is no Angular compiler step: the React plugin only turns JSX into JavaScript.
 *
 * The React Compiler (through Babel) memoizes only the components marked `'use memo'`
 * (`compilationMode: 'annotation'`): the ones that take plain values, never a Breeze entity.  See
 * "The React Compiler" in the README for which and why.  `panicThreshold: 'all_errors'` makes a
 * marked component the compiler can't compile fail the build, rather than quietly stay as it was.
 */
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ compilationMode: 'annotation', panicThreshold: 'all_errors' })] }),
  ],
  server: {
    port: 5173,
    // The server's CORS policy and the app's OAuth redirect URIs name this port, so fail rather
    // than move to another one if it is taken.
    strictPort: true,
    open: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
