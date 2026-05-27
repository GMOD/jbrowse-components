import { TextDecoder, TextEncoder } from 'node:util'

import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'

export function setupEnv() {
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
  global.localStorage = dom.window.localStorage as unknown as Storage
}
