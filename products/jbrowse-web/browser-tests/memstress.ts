/* eslint-disable no-console */
// Randomized long-running leak/resource stress test for jbrowse-web.
//
//   node --experimental-strip-types memstress.ts [rounds]
//
// Drives volvox with random scrolling/zooming and random open/close of BAM,
// CRAM and BigWig tracks via the exposed window.JBrowseSession model (far more
// reliable than clicking the track selector). Every round it forces GC on the
// main thread + all RPC workers and reports the post-GC heap FLOOR plus DOM
// node / listener / worker counts. A rising floor or unbounded node/listener
// growth across rounds = a real leak; transient garbage is collected away.
//
// Env: HEADLESS=0 to watch, ROUNDS=n, SEED=n for a reproducible action stream.
import {
  BASE_CHROME_ARGS,
  createTestServer,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import type { CDPSession, Page } from 'puppeteer'

const repoRoot = '/home/cdiesh/src/jbrowse-components2'
const jbrowseWebRoot = `${repoRoot}/products/jbrowse-web`
const PORT = 3402
const ROUNDS = Number(process.env.ROUNDS || process.argv[2] || 20)
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

// deterministic PRNG (mulberry32) so a SEED reproduces the action stream
let seedState = Number(process.env.SEED || 0x9e3779b9) >>> 0
function rand() {
  seedState |= 0
  seedState = (seedState + 0x6d2b79f5) | 0
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)]!
const randint = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo))

// track pool: unique-id mix of bam/cram/bigwig, toggled by trackId
const TRACKS = [
  'volvox_bam', // BamAdapter
  'spliced', // BamAdapter (rnaseq)
  'volvox-long-reads-bam', // BamAdapter (long reads)
  'volvox_cram', // CramAdapter
  'Deep sequencing', // CramAdapter
  'volvox-long-reads-cram', // CramAdapter
  'volvox_microarray_line', // BigWigAdapter
  'volvox_microarray_density', // BigWigAdapter
  'volvox_microarray', // BigWigAdapter (xyplot)
]

function randomLoc() {
  const ctg = rand() < 0.8 ? 'ctgA' : 'ctgB'
  const max = ctg === 'ctgA' ? 50000 : 6000
  const start = randint(1, max - 500)
  const width = randint(500, Math.min(20000, max - start))
  return `${ctg}:${start}-${start + width}`
}

async function heapUsage(s: CDPSession) {
  await s.send('Runtime.enable')
  return s.send('Runtime.getHeapUsage').catch(() => ({ usedSize: 0 }))
}
async function forceGc(s: CDPSession) {
  await s.send('HeapProfiler.enable').catch(() => {})
  await s.send('HeapProfiler.collectGarbage').catch(() => {})
}

async function waitRender(page: Page) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout: 30000, polling: 200 },
    )
    .catch(() => {})
}

async function setupWorkerTracking(page: Page) {
  const workers = new Map<string, CDPSession>()
  const client = await page.createCDPSession()
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  })
  client.on('Target.attachedToTarget', (e: any) => {
    const { targetInfo, sessionId } = e
    if (targetInfo.type === 'worker' || targetInfo.type === 'shared_worker') {
      const s = (client as any).connection()?.session(sessionId)
      if (s) {
        workers.set(targetInfo.targetId, s)
      }
    }
  })
  client.on('Target.detachedFromTarget', (e: any) => {
    for (const [id] of workers) {
      if (id === e.targetId) {
        workers.delete(id)
      }
    }
  })
  return workers
}

// Simulate leaving the tab and coming back. Fires the real lifecycle events
// jbrowse listens to: visibilitychange (hidden) → pagehide(persisted) disposes
// every GPU rendering backend, then pageshow(persisted) bumps contextVersion to
// re-init and visibilitychange (visible) triggers the restore re-render. A
// leak here = GPU contexts / canvases / backends accumulating across cycles.
// Override document visibility, fire visibilitychange, then dispatch a
// PageTransitionEvent (persisted=true so jbrowse treats it as bfcache).
async function visibilityTransition(
  page: Page,
  hidden: boolean,
  transition: string,
) {
  await page.evaluate(
    (h, name) => {
      Object.defineProperties(document, {
        hidden: { configurable: true, get: () => h },
        visibilityState: {
          configurable: true,
          get: () => (h ? 'hidden' : 'visible'),
        },
      })
      document.dispatchEvent(new Event('visibilitychange'))
      const e = new Event(name)
      Object.defineProperty(e, 'persisted', { value: true })
      window.dispatchEvent(e)
    },
    hidden,
    transition,
  )
}

async function tabLeave(page: Page) {
  await visibilityTransition(page, true, 'pagehide') // disposes GPU backends
  await new Promise(r => setTimeout(r, 500))
  // pageshow bumps contextVersion → GPU backend re-init; visible → restore render
  await visibilityTransition(page, false, 'pageshow')
  await new Promise(r => setTimeout(r, 500))
}

// Perform one randomized action against the live view model.
async function act(page: Page) {
  const track = pick(TRACKS)
  const loc = randomLoc()
  return page.evaluate(
    (trackId, locStr, r) => {
      const s = (window as any).JBrowseSession
      const view = s?.views?.[0]
      if (!view) {
        return 'noview'
      }
      const shown = new Set(
        view.tracks.map((t: any) => t.configuration.trackId),
      )
      if (r < 0.4) {
        // toggle a track on/off (display create/destroy lifecycle)
        if (shown.has(trackId)) {
          view.hideTrack(trackId)
          return `hide ${trackId}`
        }
        view.showTrack(trackId)
        return `show ${trackId}`
      } else if (r < 0.7) {
        view.navToLocString(locStr)
        return `nav ${locStr}`
      } else if (r < 0.85) {
        // zoom in/out about the center
        const factor = Math.random() < 0.5 ? 0.5 : 2
        view.zoomTo(view.bpPerPx * factor)
        return `zoom x${factor}`
      } else {
        // horizontal scroll
        view.scrollTo(view.offsetPx + (Math.random() < 0.5 ? -400 : 400))
        return `scroll`
      }
    },
    track,
    loc,
    rand(),
  )
}

const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
const browser = await puppeteer.launch({
  headless: process.env.HEADLESS !== '0',
  protocolTimeout: 600000,
  args: [
    ...BASE_CHROME_ARGS,
    '--ignore-gpu-blocklist',
    '--use-angle=gl',
    '--use-gl=angle',
    '--window-size=1400,900',
    '--js-flags=--expose-gc',
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 800 })
const workers = await setupWorkerTracking(page)
const main = await page.createCDPSession()

const errors: string[] = []
page.on('console', m => {
  const t = m.text()
  if (m.type() === 'error' && !/favicon|net::ERR|404/.test(t)) {
    errors.push(t)
  }
})
page.on('pageerror', e => {
  errors.push(`pageerror: ${e instanceof Error ? e.message : String(e)}`)
})

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam', 'volvox_cram', 'volvox_microarray_line'],
    },
  ],
}
const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Stress`
console.log(`stress: ${ROUNDS} rounds, seed=${seedState}`)
await page.goto(url, { waitUntil: 'load', timeout: 120000 })
await waitRender(page)
await new Promise(r => setTimeout(r, 2000))

async function floor(label: string) {
  await forceGc(main)
  for (const [, s] of workers) {
    await forceGc(s)
  }
  await new Promise(r => setTimeout(r, 700))
  const m = await heapUsage(main)
  let w = 0
  for (const [, s] of workers) {
    w += (await heapUsage(s)).usedSize
  }
  const met = await page.metrics()
  const { openTracks, canvases } = await page
    .evaluate(() => ({
      openTracks: (window as any).JBrowseSession?.views?.[0]?.tracks?.length,
      canvases: document.querySelectorAll('canvas').length,
    }))
    .catch(() => ({ openTracks: -1, canvases: -1 }))
  console.log(
    `  ${label.padEnd(9)} main ${mb(m.usedSize).padStart(9)}  worker ${mb(w).padStart(9)}  ` +
      `nodes ${String(met.Nodes).padStart(6)}  listeners ${String(met.JSEventListeners).padStart(5)}  ` +
      `canvas ${String(canvases).padStart(3)}  wkrs ${workers.size}  openTracks ${openTracks}`,
  )
  return { main: m.usedSize, worker: w, nodes: met.Nodes ?? 0, canvases }
}

console.log('\n=== post-GC floor per round (rising floor/nodes = leak) ===')
const base = await floor('baseline')
let last = base
for (let round = 1; round <= ROUNDS; round++) {
  const actionsPerRound = randint(4, 9)
  for (let i = 0; i < actionsPerRound; i++) {
    await act(page)
    await new Promise(r => setTimeout(r, randint(150, 450)))
    await waitRender(page)
  }
  // every 3rd round, leave the tab and come back (GPU dispose → re-init cycle)
  if (round % 3 === 0) {
    await tabLeave(page)
    await waitRender(page)
  }
  last = await floor(`round ${round}`)
}

const dMain = last.main - base.main
const dWorker = last.worker - base.worker
const dNodes = last.nodes - base.nodes
const dCanvas = last.canvases - base.canvases
console.log('\n=== summary (last round − baseline, post-GC) ===')
console.log(`  main heap   Δ ${mb(dMain)}`)
console.log(`  worker heap Δ ${mb(dWorker)}`)
console.log(`  DOM nodes   Δ ${dNodes}`)
console.log(`  canvases    Δ ${dCanvas}`)
console.log(`  console errors: ${errors.length}`)
for (const e of errors.slice(0, 10)) {
  console.log(`    ! ${e}`)
}

await browser.close()
server.close()
process.exit(0)
