// this is a little polyfill for running in workers that
// contains just enough stubbing to make webpack style-loader
// think that it is actually inserting styles into the DOM

self.window = {
  Date: self.Date,
  addEventListener() {},
  cancelAnimationFrame: () => {},
  cancelIdleCallback: () => {},
  fetch: self.fetch.bind(self),
  location: self.location,
  navigator: {},
  requestAnimationFrame: cb => cb(),
  requestIdleCallback: cb => cb(),
}
self.document = {
  createElement() {
    return {
      appendChild() {},
      removeAttribute() {},
      setAttribute() {},
      style: {},
    }
  },
  createTextNode() {},
  documentElement: {},
  querySelector() {
    return { appendChild() {} }
  },
  querySelectorAll: () => [],
}
