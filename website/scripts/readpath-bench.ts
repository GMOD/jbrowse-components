// Does withholding `onProgress` buy a faster read? Four places in the tree said
// so — `res.arrayBuffer()` called "the fast path" — and none of them had a
// number. It is backwards for every body under ~10MB.
//
// `downloadStatus` hands generic-filehandle2 no `onProgress` when there is no
// statusCallback, which routes the read to `toBytes` (one native `res.bytes()`)
// instead of `toBytesWithProgress` (a getReader loop, an `out.set` per chunk).
// Both arms here read the same bytes off the same local server, so the network
// is held constant and only the read path differs.
//
// **In a Chrome worker, which is the realm that ships.** Node's undici answered
// the opposite way at every size, so a node microbench would have "confirmed"
// the claim. The arms run inside a `new Worker`, not on the page, for the same
// reason.
//
// Read the RATIO, not the milliseconds — see the notes on the measurement
// record, which the absolute numbers move by 3x with machine load while the
// ratio holds.
//
//   node website/scripts/readpath-bench.ts
//
// Record: agent-docs/measurements/download-read-path.json
import { createServer } from 'node:http'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import type { AddressInfo } from 'node:net'

const SIZES: [string, number][] = [
  ['256 KB', 1 << 18],
  ['1 MB', 1 << 20],
  ['4 MB', 4 << 20],
  ['10 MB', 10 << 20],
  ['25 MB', 25 << 20],
  ['50 MB', 50 << 20],
  ['100 MB', 100 << 20],
  ['200 MB', 200 << 20],
]
const RUNS = 15

const payloads = new Map(
  SIZES.map(([label, n]) => {
    const buf = Buffer.allocUnsafe(n)
    for (let i = 0; i < n; i += 4096) {
      buf.writeUInt32LE(i, i)
    }
    return [label, buf]
  }),
)

const WORKER_SRC = `
async function toBytes(res) {
  return res.bytes ? res.bytes() : new Uint8Array(await res.arrayBuffer())
}
function parseContentLength(res) {
  const header = res.headers.get('content-length')
  const parsed = header === null ? Number.NaN : Number(header)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}
async function toBytesWithProgress(res, onProgress) {
  const total = parseContentLength(res)
  const body = res.body
  if (!body || total === undefined) {
    const bytes = await toBytes(res)
    onProgress(bytes.byteLength, total ?? bytes.byteLength)
    return bytes
  }
  const reader = body.getReader()
  let out = new Uint8Array(total)
  let received = 0
  let lastTick = Date.now()
  onProgress(0, total)
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    if (received + chunk.value.byteLength > out.length) {
      const grown = new Uint8Array(Math.max(received + chunk.value.byteLength, out.length * 2))
      grown.set(out.subarray(0, received))
      out = grown
    }
    out.set(chunk.value, received)
    received += chunk.value.byteLength
    const now = Date.now()
    if (now - lastTick >= 50) { lastTick = now; onProgress(received, total) }
  }
  onProgress(received, total)
  return received === out.length ? out : out.slice(0, received)
}
self.onmessage = async e => {
  const { url, runs } = e.data
  const plain = []
  const progress = []
  let chunks = 0
  for (let i = 0; i < runs; i++) {
    let t = performance.now()
    let b = await toBytes(await fetch(url, { cache: 'no-store' }))
    plain.push(performance.now() - t)
    if (b.byteLength === 0) { throw new Error('empty') }

    t = performance.now()
    chunks = 0
    b = await toBytesWithProgress(await fetch(url, { cache: 'no-store' }), () => { chunks++ })
    progress.push(performance.now() - t)
    if (b.byteLength === 0) { throw new Error('empty') }
  }
  self.postMessage({ plain, progress, chunks, hasBytes: typeof Response.prototype.bytes === 'function' })
}
`

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').slice(1))
  if (path === 'worker.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(WORKER_SRC)
    return
  }
  if (path === '') {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><meta charset=utf8><title>bench</title>')
    return
  }
  const body = payloads.get(path)
  if (!body) {
    // Chrome asks for /favicon.ico on its own; anything else unknown is a bug
    // in the bench rather than something to serve zero bytes for.
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  })
  res.end(body)
})
await new Promise<void>(r => {
  server.listen(0, '127.0.0.1', () => {
    r()
  })
})
const { port } = server.address() as AddressInfo
const origin = `http://127.0.0.1:${port}`

const browser = await launch({
  executablePath: findChromeExecutable(),
  args: BASE_CHROME_ARGS,
  headless: true,
})
const page = await browser.newPage()
await page.goto(`${origin}/`)

const med = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
const rows = []
for (const [label] of SIZES) {
  const out = (await page.evaluate(
    async (origin, label, runs) => {
      const w = new Worker(`${origin}/worker.js`)
      const p = new Promise((resolve, reject) => {
        w.onmessage = e => {
          resolve(e.data)
        }
        w.onerror = e => {
          reject(new Error(e.message))
        }
      })
      w.postMessage({
        url: `${origin}/${encodeURIComponent(label)}`,
        runs,
      })
      const r = await p
      w.terminate()
      return r
    },
    origin,
    label,
    RUNS,
  )) as {
    plain: number[]
    progress: number[]
    chunks: number
    hasBytes: boolean
  }
  rows.push({
    label,
    plainMs: med(out.plain),
    progressMs: med(out.progress),
    plainMin: Math.min(...out.plain),
    progressMin: Math.min(...out.progress),
    chunks: out.chunks,
    hasBytes: out.hasBytes,
  })
}

await browser.close()
server.close()

console.log(`Response.prototype.bytes available: ${rows[0]!.hasBytes}`)
console.log(
  [
    'size',
    'bytes() med/min',
    'loop med/min',
    'ratio(med)',
    'ratio(min)',
    'ticks',
  ].join('\t'),
)
for (const r of rows) {
  console.log(
    [
      r.label,
      `${r.plainMs.toFixed(1)}/${r.plainMin.toFixed(1)}`,
      `${r.progressMs.toFixed(1)}/${r.progressMin.toFixed(1)}`,
      `${(r.progressMs / r.plainMs).toFixed(2)}x`,
      `${(r.progressMin / r.plainMin).toFixed(2)}x`,
      r.chunks,
    ].join('\t'),
  )
}
