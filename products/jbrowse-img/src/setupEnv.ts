import { TextDecoder, TextEncoder } from 'util'

import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'

export default function setupEnv() {
  addGlobalCanvasUtils()
  addGlobalTextUtils()
  addGlobalDocument()
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

function addGlobalDocument() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    resources: "usable",
  })
  // @ts-expect-error
  global.window = dom.window
  global.document = window.document
  global.localStorage = window.localStorage
}
