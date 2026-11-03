import { createRequire } from 'node:module'
import { TextDecoder, TextEncoder } from 'node:util'

import { JSDOM } from 'jsdom'
import { enableStaticRendering } from 'mobx-react'

let ready = false

/** `batch` calls it as well as whoever called `batch` */
export function setupEnv() {
  if (ready) {
    return
  }
  ready = true
  // otherwise observer reactions outlive the static render and read dead MST
  // nodes on destroy()
  enableStaticRendering(true)

  // jsdom's undici takes over Node's built-in fetch, which then loses HTTP/2
  // headers and leaves compressed bodies undecoded
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
