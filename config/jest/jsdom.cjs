// jest's jsdom environment over the jsdom this repo pins, rather than the one
// jest-environment-jsdom bundles. jsdom 26's getComputedStyle matches every
// emotion rule through nwsapi for each ancestor of each element, which is where
// a testing-library `*ByRole` query spends its time; jsdom 30 answers the same
// suites in roughly two thirds of the CPU.
//
// The default project's environment extends this (`jsdomWithFetch.cjs`); a
// suite in a node project opts into it with
// `@jest-environment <rootDir>/config/jest/jsdom.cjs`.
const JSDOMEnvironment = require('@jest/environment-jsdom-abstract').default
const jsdom = require('jsdom')

module.exports = class JSDOM30Environment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context, jsdom)
  }
}
