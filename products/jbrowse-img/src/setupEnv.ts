import { TextDecoder, TextEncoder } from 'util'

import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'

export function setupEnv() {
  addGlobalCanvasUtils()
  addGlobalTextUtils()
  addGlobalDocument()
  addDataUrlFetchSupport()
}

// Node.js native fetch doesn't support data URLs, but some libraries
// (like @gmod/bgzf-filehandle) use data URLs to embed WASM binaries.
// This wrapper handles data URLs by decoding them directly.
function addDataUrlFetchSupport() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async function (input, init) {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url.startsWith('data:')) {
      return handleDataUrl(url)
    }
    return originalFetch.call(globalThis, input, init)
  }
}

function handleDataUrl(dataUrl: string): Response {
  // Parse data URL: data:[<mediatype>][;base64],<data>
  const match = /^data:([^;,]*)(;base64)?,(.*)$/.exec(dataUrl)
  if (!match) {
    throw new TypeError('Invalid data URL')
  }
  const [, mimeType = 'text/plain', isBase64, data = ''] = match
  const bytes = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data))

  return new Response(new Blob([bytes], { type: mimeType }))
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
    resources: 'usable',
  })
  // @ts-expect-error
  global.window = dom.window
  global.document = window.document
  global.localStorage = window.localStorage
}
