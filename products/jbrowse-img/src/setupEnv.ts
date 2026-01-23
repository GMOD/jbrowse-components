import { TextDecoder, TextEncoder } from 'util'

import { Agent, setGlobalDispatcher } from 'undici'
import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'

export default function setupEnv() {
  addGlobalCanvasUtils()
  addGlobalTextUtils()
  addGlobalDocument()
  addGlobalHttpDispatcher()
}

function addGlobalHttpDispatcher() {
  // Limit concurrent connections to prevent overwhelming the server
  const dispatcher = new Agent({
    connections: 10, // Limit concurrent kept-alive connections
    pipelining: 1, // Disable pipelining for sequential requests
    headersTimeout: 30_000, // 30 seconds
    bodyTimeout: 30_000, // 30 seconds
  })
  setGlobalDispatcher(dispatcher)
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
