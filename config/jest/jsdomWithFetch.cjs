const JSDOMEnvironment = require('jest-environment-jsdom').default

// jsdom ships no fetch/Response/Request at all, and a partial, request-guarded
// `Headers` that STRIPS the `range` request header — unlike a real browser,
// whose default-guard Headers keeps it. A range-stripping Headers silently
// breaks RemoteFileWithRangeCache, which is most of what this repo fetches.
//
// Node's own (undici) primitives are the real ones and preserve `range`, so
// install those instead. Taking them here rather than in a setup file is what
// makes it possible at all: inside the environment constructor `globalThis` is
// still Node's realm, while a setup file already sees the jsdom global.
//
// They must be installed as ONE consistent set. Mixing jsdom's Headers with
// another realm's Response/Request is exactly the mismatch that made the old
// jest-fetch-mock setup delete jsdom's copies before calling enableMocks().
const FETCH_GLOBALS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'AbortController',
  'AbortSignal',
  'ReadableStream',
  'Blob',
]

module.exports = class JSDOMWithFetchEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context)
    for (const name of FETCH_GLOBALS) {
      if (globalThis[name] !== undefined) {
        this.global[name] = globalThis[name]
      }
    }
  }
}
