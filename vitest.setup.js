import '@testing-library/jest-dom/vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverStub;
}

if (typeof global !== "undefined" && !global.ResizeObserver) {
  global.ResizeObserver = ResizeObserverStub;
}
