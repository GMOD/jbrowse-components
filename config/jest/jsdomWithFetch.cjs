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
//
// What stays OUT is a type jsdom implements AND brand-checks from its OWN
// implementation of the type that consumes it. Overriding one of those breaks
// the pair, and neither realm can satisfy both halves — so the tie goes to the
// pair the app code actually uses. `jsdomRealms.test.ts` pins both, including
// what each choice costs.
//
// - **AbortController/AbortSignal**: jsdom's EventTarget brand-checks the
//   signal, so `document.addEventListener(t, fn, { signal })` throws "member
//   'signal' that is not of type 'AbortSignal'" for a node-realm one. Every
//   drag gesture in the app aborts its listeners that way.
// - **Blob**: jsdom's `FileReader.readAsText` brand-checks it, and every export
//   feature in the app pairs `new Blob(...)` with `saveAs`. Overriding it threw
//   "parameter 1 is not of type 'Blob'" in six tests across two suites and
//   nothing else — it was in this set only for symmetry with `Response`, which
//   never needed it. What node's Blob genuinely had over jsdom's is
//   `text`/`arrayBuffer`/`stream`, and `config/jest/blob.js` fills those off
//   jsdom's own FileReader instead. The residual price is that undici
//   stringifies a jsdom Blob handed to `new Response(blob)`; nothing here does
//   that.
//
// The compression streams ride along: jsdom has none, and they pipe through
// the ReadableStream installed here.
const FETCH_GLOBALS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'ReadableStream',
  'CompressionStream',
  'DecompressionStream',
]

// jsdom has no MessageChannel, and React's scheduler posts through one. Node's
// ports live outside the sandbox, so a port left open keeps its `onmessage`
// closure and with it the suite's whole module graph: every suite that loaded
// React stayed resident in the worker for the rest of the run. Hence teardown
// closes every port. `onmessage` refs a port, so it is unref'd again after, or
// an idle one holds the worker's event loop open.
module.exports = class JSDOMWithFetchEnvironment extends JSDOMEnvironment {
  ports = []

  constructor(config, context) {
    super(config, context)
    for (const name of FETCH_GLOBALS) {
      if (globalThis[name] !== undefined) {
        this.global[name] = globalThis[name]
      }
    }
    const ports = this.ports
    this.global.MessageChannel = class {
      constructor() {
        const channel = new MessageChannel()
        ports.push(channel.port1, channel.port2)
        this.port1 = new Proxy(channel.port1, {
          set(port1, prop, value) {
            const result = Reflect.set(port1, prop, value)
            if (prop === 'onmessage') {
              port1.unref()
            }
            return result
          },
        })
        this.port2 = channel.port2
      }
    }
  }

  async teardown() {
    for (const port of this.ports) {
      port.close()
    }
    this.ports = []
    await super.teardown()
  }
}
