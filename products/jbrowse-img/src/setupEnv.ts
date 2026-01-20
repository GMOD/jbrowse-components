import { TextDecoder, TextEncoder } from 'util'

import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'
import fetch, { Headers, Request, Response } from 'node-fetch'

export default function setupEnv() {
  addGlobalCanvasUtils()
  addGlobalTextUtils()
  addGlobalDocument()
  addFetchPolyfill()
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
  const window = new JSDOM('...').window
  global.document = window.document
  // @ts-expect-error
  global.window = window
}

function addFetchPolyfill() {
  // @ts-expect-error
  global.fetch = fetch
  // @ts-expect-error
  global.Headers = Headers
  // @ts-expect-error
  global.Response = Response
  // @ts-expect-error
  global.Request = Request
}
