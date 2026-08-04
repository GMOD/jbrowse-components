// Does the SharedArrayBuffer stop-token path earn its keep?
//
// The light-load comparison in coi-probe.ts says no, but that workload has
// almost nothing to cancel. Stop tokens exist for the opposite case: a worker
// deep in a long feature-processing loop that the user interrupts by navigating
// away. Both paths cancel at await boundaries off a posted token id; SAB adds an
// atomic read every 10 iterations, which is the only way to interrupt a loop
// that never yields. This drives an ultra-deep (~2000x) BAM through a burst of
// rapid navigations — each one cancelling the last — and measures how long the
// view takes to settle afterwards.
//
// This bench once measured the blob-URL/sync-XHR probe at zero (513 ms either
// way with the message path in) and it was deleted on that basis, then restored:
// every loop on the alignments path already yields at region granularity, so
// nothing here exercises intra-loop cancellation. getLDMatrix's await-free O(n^2)
// fill does, and this workload never reaches it. Pick the workload for its loop
// shape before concluding anything about the probe.
//
//   node scripts/cancel-bench.ts [--coi] [--runs=3] [--hops=6]
import http from 'node:http'
import path from 'node:path'

import {
  SANDBOX_CHROME_ARGS,
  findChromeExecutable,
  delay,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

import { lgvSession } from './screenshot-spec-helpers.ts'

import type { Browser } from 'puppeteer'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const webRoot = path.join(repoRoot, 'products', 'jbrowse-web')
const buildPath = path.join(webRoot, 'build')

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const coi = process.argv.includes('--coi')
const runs = Number(arg('runs', '3'))
const hops = Number(arg('hops', '6'))
const PORT = coi ? 3391 : 3392

function serve() {
  return new Promise<http.Server>(resolve => {
    const server = http.createServer((req, res) => {
      if (coi) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader(
          'Cross-Origin-Embedder-Policy',
          process.argv.includes('--credentialless')
            ? 'credentialless'
            : 'require-corp',
        )
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      }
      res.setHeader('Access-Control-Allow-Origin', '*')
      const url = req.url ?? '/'
      const pub = url.startsWith('/extra_test_data/')
        ? repoRoot
        : url.startsWith('/test_data/')
          ? webRoot
          : buildPath
      void handler(req, res, { public: pub })
    })
    server.listen(PORT, () => {
      resolve(server)
    })
  })
}

// Windows stay under AUTO_FORCE_LOAD_BP (20kb) so the display auto-loads instead
// of showing the force-load prompt and rendering nothing.
const WINDOWS = [
  'ctgA:20000-30000',
  'ctgA:24000-34000',
  'ctgA:28000-38000',
  'ctgA:32000-42000',
  'ctgA:36000-46000',
  'ctgA:40000-50000',
  'ctgA:44000-54000',
  'ctgA:48000-58000',
]

async function once(browser: Browser) {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    const p = { blobUrls: 0, sabs: 0, stopFrames: 0 }
    ;(window as unknown as { __c: typeof p }).__c = p
    const orig = URL.createObjectURL
    URL.createObjectURL = function (o: Blob | MediaSource) {
      p.blobUrls++
      return orig.call(URL, o)
    }
    const send = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (this: Worker, msg: unknown, ...r) {
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
          p.sabs++
          return
        }
        for (const k of Object.keys(v)) {
          walk((v as Record<string, unknown>)[k], d + 1)
        }
      }
      walk(msg, 0)
      // the stop-token notification frame: this is what actually cancels a
      // superseded fetch, so a burst that reports 0 of these means cancellation
      // is silently doing nothing
      if (
        msg !== null &&
        typeof msg === 'object' &&
        typeof (msg as { stopToken?: unknown }).stopToken === 'string'
      ) {
        p.stopFrames++
      }
      // eslint-disable-next-line prefer-spread
      send.apply(this, [msg, ...r] as Parameters<typeof send>)
    } as typeof send
  })

  const url = `http://localhost:${PORT}/${lgvSession(
    'extra_test_data/volvox-ultradeep.json',
    { assembly: 'volvox', loc: WINDOWS[0]!, tracks: ['volvox_ultradeep'] },
  )}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('[data-testid="zoom_in"]', { timeout: 120000 })
  await waitForDisplayPhases(page, 120000)
  await waitForDisplaysDone(page, 120000)
  await delay(1500)

  // burst: each hop lands while the previous fetch is still in flight, so every
  // one of them has to be cancelled
  const t0 = Date.now()
  for (let i = 1; i <= hops; i++) {
    await page.evaluate(
      (loc: string) => {
        const w = window as unknown as {
          JBrowseSession: { views: { navToLocString: (s: string) => void }[] }
        }
        w.JBrowseSession.views[0]!.navToLocString(loc)
      },
      WINDOWS[i % WINDOWS.length]!,
    )
    await delay(350)
  }
  const lastNav = Date.now()
  await waitForDisplayPhases(page, 120000)
  await waitForDisplaysDone(page, 120000)
  await waitForQuiescent(page, { timeout: 120000 })
  const settleAfterLastNav = Date.now() - lastNav
  const total = Date.now() - t0

  const probe = await page.evaluate(
    () =>
      (
        window as unknown as {
          __c: { blobUrls: number; sabs: number; stopFrames: number }
        }
      ).__c,
  )
  const isolated = await page.evaluate(() => self.crossOriginIsolated)
  await page.close()
  return { settleAfterLastNav, total, ...probe, isolated }
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

const server = await serve()
const browser = await launch({
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
  executablePath: findChromeExecutable(),
  args: [...SANDBOX_CHROME_ARGS, '--use-angle=gl'],
})
const out: Awaited<ReturnType<typeof once>>[] = []
try {
  for (let i = 0; i < runs; i++) {
    out.push(await once(browser))
    process.stderr.write(`  run ${i + 1}/${runs}\n`)
  }
} finally {
  await browser.close()
  server.close()
}
process.stderr.write(
  `${[
    `COOP/COEP: ${coi}  crossOriginIsolated: ${out[0]!.isolated}`,
    `stop tokens: ${out[0]!.blobUrls} blob URLs, ${out[0]!.sabs} SharedArrayBuffers`,
    `stop-token frames posted to workers: ${out.map(r => r.stopFrames).join(' ')}`,
    `settle after last of ${hops} hops: median ${median(out.map(r => r.settleAfterLastNav))} ms  ${out.map(r => r.settleAfterLastNav).join(' ')}`,
    `whole burst:              median ${median(out.map(r => r.total))} ms  ${out.map(r => r.total).join(' ')}`,
  ].join('\n')}\n`,
)
