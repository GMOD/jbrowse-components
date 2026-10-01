/* eslint-disable no-console */
// Does a range read the browser is still holding in its HTTP/1.1 per-host
// queue fail with "No response … after 30s"?
//
// Chrome opens six connections per HTTP/1.1 host, shared by every worker and
// tab of the page, and a seventh fetch waits with its promise pending. The
// server here answers every request's headers at once and takes BODY_MS over
// each body, so with eight reads two of them sit in that queue for longer than
// @gmod/range-cache-filehandle's response deadline. Every read should still
// complete; one that rejects without ever reaching the server is the bug.
//
// Serves the installed packages' own esm builds rather than the app, so it
// needs no build. Env: N (reads), WORKERS (contexts they are split across),
// BODY_MS, PUPPETEER_EXECUTABLE_PATH.
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'

import puppeteer from 'puppeteer'

import type { AddressInfo } from 'node:net'

const BODY_MS = Number(process.env.BODY_MS ?? 35000)
const N = Number(process.env.N ?? 8)
const WORKERS = Number(process.env.WORKERS ?? 2)
const SIZE = 1024 * 1024

const fromCore = createRequire(
  path.join(import.meta.dirname, '../../../packages/core/package.json'),
)
// `require.resolve` answers with the package's cjs entry, which sits beside esm/
const rangeCacheEntry = fromCore.resolve('@gmod/range-cache-filehandle')
const esmBeside = (entry: string) => path.join(path.dirname(entry), '../esm')
const roots: Record<string, string> = {
  '/rcf/': esmBeside(rangeCacheEntry),
  '/gfh/': esmBeside(
    createRequire(rangeCacheEntry).resolve('generic-filehandle2'),
  ),
}

interface Result {
  i: number
  worker: number
  ms: number
  error?: string
}

const workerJs = `
import { RemoteFileWithRangeCache } from '/rcf/index.js'
onmessage = async ({ data: { ids, origin, worker } }) => {
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  postMessage(await Promise.all(ids.map(i =>
    new RemoteFileWithRangeCache(origin + '/data/' + i).read(100, 0).then(
      () => ({ i, worker, ms: ms() }),
      e => ({ i, worker, ms: ms(), error: String(e.message).slice(0, 110) }),
    ))))
}`

const pageHtml = `<!doctype html><script type="module">
const per = ${N} / ${WORKERS}
window.results = Promise.all(Array.from({ length: ${WORKERS} }, (_, w) =>
  new Promise(resolve => {
    const worker = new Worker('/worker.js', { type: 'module' })
    worker.onmessage = e => resolve(e.data)
    worker.postMessage({
      ids: Array.from({ length: per }, (_, k) => w * per + k),
      origin: location.origin,
      worker: w,
    })
  }))).then(r => r.flat())
</script>`

const arrivals = new Map<string, number>()
const t0 = Date.now()

const server = http.createServer((req, res) => {
  const url = req.url ?? ''
  const root = Object.keys(roots).find(prefix => url.startsWith(prefix))
  if (root) {
    // a worker has no import map, so the bare specifier is rewritten here
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(
      fs
        .readFileSync(path.join(roots[root]!, url.slice(root.length)), 'utf8')
        .replaceAll("'generic-filehandle2'", "'/gfh/browser.js'"),
    )
  } else if (url === '/worker.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(workerJs)
  } else if (url.startsWith('/data/')) {
    arrivals.set(url, Date.now() - t0)
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? '')!
    const start = Number(from)
    const end = Math.min(Number(to), SIZE - 1)
    res.writeHead(206, {
      'content-range': `bytes ${start}-${end}/${SIZE}`,
      'content-length': end - start + 1,
    })
    res.flushHeaders()
    setTimeout(() => res.end(Buffer.alloc(end - start + 1)), BODY_MS)
  } else {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(pageHtml)
  }
})
await new Promise<void>(resolve => {
  server.listen(0, '127.0.0.1', resolve)
})
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
})
const tab = await browser.newPage()
await tab.goto(origin)
const results = (await tab.evaluate(
  () => (window as unknown as { results: Promise<unknown> }).results,
)) as Result[]

console.log(
  `${N} reads across ${WORKERS} workers; headers at once, ${BODY_MS / 1000}s per body`,
)
for (const r of results) {
  const arrived = arrivals.get(`/data/${r.i}`)
  console.log(
    `worker ${r.worker} read ${r.i}: reached server`,
    arrived === undefined ? 'NEVER' : `at ${(arrived / 1000).toFixed(1)}s`,
    r.error
      ? `REJECTED at ${(r.ms / 1000).toFixed(1)}s: ${r.error}`
      : `ok at ${(r.ms / 1000).toFixed(1)}s`,
  )
}
const failed = results.filter(r => r.error).length
console.log(failed ? `${failed} read(s) rejected` : 'every read completed')

await browser.close()
server.closeAllConnections()
server.close()
process.exitCode = failed ? 1 : 0
