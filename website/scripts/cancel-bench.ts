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
import {
  SANDBOX_CHROME_ARGS,
  findChromeExecutable,
  delay,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { serveCoi } from './coi-server.ts'
import { flagArg as arg } from './dev-harness.ts'
import { lgvSession } from './screenshot-spec-helpers.ts'

import type { Browser, Page } from 'puppeteer'

const coi = process.argv.includes('--coi')
const runs = Number(arg('runs', '3'))
const hops = Number(arg('hops', '6'))
const PORT = coi ? 3391 : 3392

// Windows stay under AUTO_FORCE_LOAD_BP (20kb), where the byte gate measures
// against a budget raised by SUB_FLOOR_BYTE_BUDGET_FACTOR. That is a tier, not
// the off-switch the floor used to be, so it is not a guarantee — the fixture
// also sets `forceLoad`, and `assertNothingGated` is what checks rather than
// assumes. The comment here used to say the floor made the display auto-load,
// which stopped being true when the floor left the byte axis.
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

// This bench times cancellation of fetches, so a page that fetched nothing is
// the one result it must not report as a fast one — and that is exactly what a
// gated display produces. Every wait here is best-effort: `waitForDisplayPhases`
// and `waitForDisplaysDone` key on attributes a too-large display never
// publishes (it mounts TooLargeMessage instead of its canvas body), and a
// terminal phase resolves them immediately, so a banner reads as a clean, quick
// settle and the burst below cancels nothing.
//
// jbrowse-web's `waitForDisplayPaint` is the same guard for the suites and
// carries the diagnosis that motivated it. The session walk is duplicated rather
// than shared because both run inside the page: `waitForFunction`/`evaluate`
// serialize the callback, so it cannot close over an import.
async function assertNothingGated(page: Page) {
  const gated = await page.evaluate(() => {
    interface LiveView {
      views?: LiveView[]
      tracks?: {
        configuration?: { trackId?: string }
        displays?: { regionTooLarge?: boolean; regionTooLargeReason?: string }[]
      }[]
    }
    const out: string[] = []
    const walk = (views: LiveView[] | undefined) => {
      for (const v of views ?? []) {
        for (const t of v.tracks ?? []) {
          for (const d of t.displays ?? []) {
            if (d.regionTooLarge) {
              out.push(
                `${t.configuration?.trackId ?? '?'}: ${d.regionTooLargeReason ?? ''}`,
              )
            }
          }
        }
        walk(v.views)
      }
    }
    walk(
      (window as unknown as { JBrowseSession?: { views?: LiveView[] } })
        .JBrowseSession?.views,
    )
    return out
  })
  if (gated.length) {
    throw new Error(
      `nothing to cancel — the byte gate blocked the fetch this bench times:\n  ${gated.join(
        '\n  ',
      )}\nRaise the track's fetchSizeLimit or set forceLoad on the fixture; do not widen the windows, since the point of a ~2000x file is a read slow enough to catch in flight.`,
    )
  }
}

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
  await assertNothingGated(page)
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

const server = await serveCoi({
  port: PORT,
  coi,
  credentialless: process.argv.includes('--credentialless'),
})
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
