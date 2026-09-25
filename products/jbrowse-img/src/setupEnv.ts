import { createRequire } from 'node:module'
import { TextDecoder, TextEncoder } from 'node:util'

import { JSDOM } from 'jsdom'
import { enableStaticRendering } from 'mobx-react'

let ready = false

/** Once per process: `batch` calls it as well as whoever called `batch`. */
export function setupEnv() {
  if (ready) {
    return
  }
  ready = true
  // We render to static markup (renderToStaticMarkup), never to a live DOM, so
  // observer components must not subscribe to observables — otherwise their
  // reactions linger past the render and fire on destroy(), reading dead MST
  // nodes. This is the standard mobx SSR switch.
  enableStaticRendering(true)

  // jsdom's undici installs itself as the dispatcher behind Node's built-in
  // fetch, which then gets no headers from an HTTP/2 response and hands back a
  // compressed body undecoded. Fetch through that same undici instead.
  global.fetch = (
    createRequire(import.meta.resolve('jsdom'))('undici') as {
      fetch: typeof fetch
    }
  ).fetch

  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    resources: 'usable',
  })
  global.window = dom.window as unknown as Window & typeof globalThis
  global.document = dom.window.document
  global.localStorage = dom.window.localStorage
}
