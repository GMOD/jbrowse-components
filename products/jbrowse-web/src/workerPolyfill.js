// this is a little polyfill for running in workers that
// contains just enough stubbing to make various libraries
// think that they are running in a DOM environment

// stub React Fast Refresh globals that Vite's React plugin injects into .tsx
// files — these don't exist in the worker scope
self.$RefreshReg$ = () => {}
self.$RefreshSig$ = () => s => s

self.window = {
  addEventListener() {},
  fetch: self.fetch.bind(self),
  location: self.location,
  Date: self.Date,
  removeEventListener() {},
  requestIdleCallback: cb => {
    cb()
  },
  cancelIdleCallback: () => {},
  requestAnimationFrame: cb => {
    cb()
  },
  cancelAnimationFrame: () => {},
  navigator: {},
}
self.document = {
  createTextNode() {},
  addEventListener() {},
  querySelector() {
    return { appendChild() {} }
  },
  documentElement: {},
  querySelectorAll: () => [],
  createElement() {
    return {
      style: {},
      setAttribute() {},
      removeAttribute() {},
      appendChild() {},
    }
  },
}
