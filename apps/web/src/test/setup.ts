// Global test setup for Vitest (jsdom environment).
// Extends `expect` with Testing Library's DOM matchers and clears the DOM
// between tests to keep them isolated.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no pointer capture, which Radix primitives (Toast's swipe to
// dismiss) call on pointer events. Browsers all have it.
if (!('hasPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
}

// Nor ResizeObserver, which Radix's Switch uses (to size its hidden form input)
// when it sits inside a <form>.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

afterEach(() => {
  cleanup();
});
