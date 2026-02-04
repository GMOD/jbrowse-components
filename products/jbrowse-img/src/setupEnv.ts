import { TextDecoder, TextEncoder } from 'util'

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
  // @ts-expect-error
  global.TextDecoder = TextDecoder
}
