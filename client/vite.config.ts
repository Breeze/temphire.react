/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite builds and serves the app; Vitest, which reads this same file, runs the tests.
 *
 * Successor of `angular.json`: the dev server (`ng serve` on 4200 becomes `vite` on 5173, the
 * origin the server allows in `AllowedClientOrigins`), the production build, and the unit-test
 * builder.  There is no Angular compiler step: the React plugin only turns JSX into JavaScript.
 */
export default defineConfig({
  plugins: [react()],
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
