import { TextDecoder, TextEncoder } from 'node:util'

import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'
import { enableStaticRendering } from 'mobx-react'

export function setupEnv() {
  // We render to static markup (renderToStaticMarkup), never to a live DOM, so
  // observer components must not subscribe to observables — otherwise their
  // reactions linger past the render and fire on destroy(), reading dead MST
  // nodes. This is the standard mobx SSR switch.
  enableStaticRendering(true)

  // @ts-expect-error
  global.nodeImage = Image
  // @ts-expect-error
  global.nodeCreateCanvas = createCanvas
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
