import { TextDecoder, TextEncoder } from 'node:util'

import { Image, createCanvas } from 'canvas'

export function setupEnv() {
  addGlobalCanvasUtils()
  addGlobalTextUtils()
}

function addGlobalCanvasUtils() {
  // @ts-expect-error
  global.nodeImage = Image
  // @ts-expect-error
  global.nodeCreateCanvas = createCanvas
}

function addGlobalTextUtils() {
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}
