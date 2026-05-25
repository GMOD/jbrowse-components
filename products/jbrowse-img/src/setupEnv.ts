import { TextDecoder, TextEncoder } from 'node:util'

import { Image, createCanvas } from 'canvas'

export function setupEnv() {
  // @ts-expect-error
  global.nodeImage = Image
  // @ts-expect-error
  global.nodeCreateCanvas = createCanvas
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}
