// this is a little polyfill for running in workers that
// contains just enough stubbing to make webpack style-loader
// think that it is actually inserting styles into the DOM

/* eslint-disable no-restricted-globals */
// @ts-ignore
self.window = {
  addEventListener() {},
  fetch: self.fetch.bind(self),
  location: self.location,
  Date: self.Date,
  // @ts-ignore
  requestIdleCallback: cb => cb(),
  cancelIdleCallback: () => {},
  // @ts-ignore
  requestAnimationFrame: cb => cb(),
  cancelAnimationFrame: () => {},
  navigator: {},
}
// @ts-ignore
self.document = {
  createTextNode() {},
  querySelector() {
    return { appendChild() {} }
  },
  createElement() {
    return { style: {}, setAttribute() {}, appendChild() {} }
  },
}
