// jsdom doesn't implement ResizeObserver, which is used directly by hooks like
// useVirtualRows. A no-op mock lets components that observe element size mount
// in tests (jsdom has no layout, so there's nothing meaningful to report).
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
