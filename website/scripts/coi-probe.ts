// Does the SharedArrayBuffer stop-token fast path actually engage when the page
// IS cross-origin isolated? Serves the build with COOP/COEP so
// crossOriginIsolated becomes true, then checks the observable consequences:
//   - main thread: createStopToken should allocate NO blob URLs (it no longer
//     mints them on any path, so this is a regression check both ways)
//   - worker: no synchronous XHR to a blob: URL
//   - the session still loads (SAB has to survive the RPC arg serialization)
import http from 'node:http'
import path from 'node:path'

import {
  SANDBOX_CHROME_ARGS,
  findChromeExecutable,
  delay,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

import { VOLVOX, lgvSession } from './screenshot-spec-helpers.ts'

const repoRoot = '/home/cdiesh/src/jbrowse-components'
const webRoot = path.join(repoRoot, 'products', 'jbrowse-web')
const buildPath = path.join(webRoot, 'build')
const coi = process.argv.includes('--coi')
const PORT = coi ? 3381 : 3382

// COOP+COEP is what makes SharedArrayBuffer available at all. CORP on every
// response so same-origin subresources survive require-corp.
function serve() {
  return new Promise<http.Server>(resolve => {
    const server = http.createServer((req, res) => {
      if (coi) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      }
      res.setHeader('Access-Control-Allow-Origin', '*')
      const url = req.url ?? '/'
      void handler(req, res, {
        public: url.startsWith('/test_data/') ? webRoot : buildPath,
      })
    })
    server.listen(PORT, () => {
      resolve(server)
    })
  })
}

const server = await serve()
const browser = await launch({
  headless: true,
  defaultViewport: { width: 1280, height: 800 },
  executablePath: findChromeExecutable(),
  args: [...SANDBOX_CHROME_ARGS, '--use-angle=gl'],
})
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
page.on('console', m => {
  if (m.type() === 'error') {
    errors.push(m.text().slice(0, 200))
  }
})
await page.evaluateOnNewDocument(() => {
  const p = { blobUrls: 0, sabTokens: 0 }
  ;(window as unknown as { __coi: typeof p }).__coi = p
  const orig = URL.createObjectURL
  URL.createObjectURL = function (o: Blob | MediaSource) {
    p.blobUrls++
    return orig.call(URL, o)
  }
  // count SharedArrayBuffers handed to postMessage — the stop token crossing
  // into the worker is the thing we care about
  const send = Worker.prototype.postMessage
  Worker.prototype.postMessage = function (
    this: Worker,
    msg: unknown,
    ...rest
  ) {
    const seen = new Set<unknown>()
    const walk = (v: unknown, d: number) => {
      if (d > 4 || v === null || typeof v !== 'object' || seen.has(v)) {
        return
      }
      seen.add(v)
      if (
        typeof SharedArrayBuffer !== 'undefined' &&
        v instanceof SharedArrayBuffer
      ) {
        p.sabTokens++
        return
      }
      for (const k of Object.keys(v)) {
        walk((v as Record<string, unknown>)[k], d + 1)
      }
    }
    walk(msg, 0)
    // eslint-disable-next-line prefer-spread
    send.apply(this, [msg, ...rest] as Parameters<typeof send>)
  } as typeof send
})

const url = `http://localhost:${PORT}/${lgvSession(VOLVOX, {
  assembly: 'volvox',
  loc: 'ctgA:1-20,000',
  tracks: ['volvox_alignments', 'gff3tabix_genes', 'volvox_microarray'],
})}`
const t0 = Date.now()
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForSelector('[data-testid="zoom_in"]', { timeout: 60000 })
await waitForLoadingComplete(page, { timeout: 60000, waitForDownloads: true })
await waitForDisplayPhases(page, 60000)
await waitForDisplaysDone(page, 60000)
await waitForQuiescent(page, { timeout: 60000 })
const settled = Date.now() - t0
await delay(500)

const main = await page.evaluate(() => {
  const w = window as unknown as {
    __coi: { blobUrls: number; sabTokens: number }
  }
  return {
    ...w.__coi,
    crossOriginIsolated: self.crossOriginIsolated,
    hasSAB: typeof SharedArrayBuffer !== 'undefined',
  }
})

// a synchronous XHR to the blob: token shows up as a resource entry in the worker
let blobFetches = 0
let painted = 0
for (const w of page.workers()) {
  blobFetches += await w.evaluate(
    () =>
      performance
        .getEntriesByType('resource')
        .filter(e => e.name.startsWith('blob:')).length,
  )
}
painted = await page.evaluate(
  () => document.querySelectorAll('[data-testid$="-done"]').length,
)

process.stderr.write(
  `${[
    `COOP/COEP served: ${coi}`,
    `crossOriginIsolated: ${main.crossOriginIsolated}  SharedArrayBuffer: ${main.hasSAB}`,
    `blob URLs created on main (fallback tokens): ${main.blobUrls}`,
    `SharedArrayBuffers postMessage'd to workers: ${main.sabTokens}`,
    `blob: fetches inside workers (sync XHR probes): ${blobFetches}`,
    `displays painted: ${painted}   settled: ${settled} ms`,
    `page errors: ${errors.length}${errors.length ? ` -> ${errors.slice(0, 3).join(' | ')}` : ''}`,
  ].join('\n')}\n`,
)
await browser.close()
server.close()
