// this is a little polyfill for running in workers that
// contains just enough stubbing to make webpack style-loader
// think that it is actually inserting styles into the DOM

/* eslint-disable no-restricted-globals */
self.window = {
  addEventListener() {},
  fetch: self.fetch.bind(self),
  location: self.location,
  Date: self.Date,
  requestIdleCallback: cb => cb(),
  cancelIdleCallback: () => {},
  requestAnimationFrame: cb => cb(),
  cancelAnimationFrame: () => {},
  navigator: {},
}
self.document = {
  createTextNode() {},
  querySelector() {
    return { appendChild() {} }
  },
  createElement() {
    return {
      style: {},
      setAttribute() {},
      removeAttribute() {},
      appendChild() {},
    }
  },
}
