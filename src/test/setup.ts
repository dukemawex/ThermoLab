import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement ResizeObserver, which Recharts' ResponsiveContainer
// relies on. Provide a minimal stub so chart components can mount in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// jsdom does not implement these either; Recharts uses them for layout maths.
if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

afterEach(() => {
  // `cleanup` is a no-op outside a DOM environment, and localStorage only
  // exists in jsdom. Guard both so this setup file can be shared by the
  // node-environment and jsdom-environment test files.
  if (typeof document !== 'undefined') {
    cleanup();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
