/**
 * Runs before every test file (see `test.setupFiles` in vite.config.ts).
 *
 * `@testing-library/jest-dom` adds DOM matchers such as `toBeInTheDocument()`.  jsdom lacks a few
 * browser APIs Mantine uses; the stand-ins below are the ones Mantine's own test setup documents.
 */
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
