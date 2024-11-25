import { TextEncoder, TextDecoder } from 'util'
import { Image, createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'
import fetch, { Headers, Response, Request } from 'node-fetch'

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
  addFetchPolyfill()
}

function addFetchPolyfill() {
  // force use of node-fetch polyfill, even if node 18+ fetch is available.
  // native node 18+ fetch currently gives errors related to unidici and
  // Uint8Array:
  //
  //
  // % node --version
  // v18.12.1
  //
  // % jb2export --fasta https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.fa --bam https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam --loc ctgA:1-1000 --out out4.svg
  // [
  //   '(node:1387934) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time\n' +
  //     '(Use `node --trace-warnings ...` to show where the warning was created)'
  // ]
  // [
  //   RangeError: offset is out of bounds
  //       at Uint8Array.set (<anonymous>)
  //       at Response.arrayBuffer (node:internal/deps/undici/undici:6117:23)
  //       at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
  // ]

  // @ts-expect-error
  global.fetch = fetch
  // @ts-expect-error
  global.Headers = Headers
  // @ts-expect-error
  global.Response = Response
  // @ts-expect-error
  global.Request = Request
}
