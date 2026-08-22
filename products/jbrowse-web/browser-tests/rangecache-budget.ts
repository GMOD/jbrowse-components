/* eslint-disable no-console */
// Is RemoteFileWithRangeCache's 256 MB budget earning anything for an indexed
// BAM, or is the layer above it absorbing every repeat?
//
// rangecache-probe.ts asks whether this cache gives memory back. This asks
// whether it should be holding that much in the first place. @gmod/bam caches
// PARSED features keyed by bgzf chunk, so a re-read of a region it has already
// parsed is answered upstairs and never reaches the filehandle at all — which
// would leave the raw layer earning its keep only on index blocks and on 256 KB
// blocks straddling two bgzf chunks.
//
// Three phases, counting bytes on the wire per phase (worker targets included,
// since that is where alignments fetches are issued):
//
//   A  pan forward over N windows          — cold, both caches empty
//   B  pan back over the same N windows    — warm, both caches hot
//   C  idle four minutes, pan forward again
//
// Run it against two builds, one with the stock MAX_CACHE_ENTRIES and one with a
// tiny one. If A and B barely move between them, the budget is not buying
// anything. They didn't: 1000 entries to 4 cost one extra request and 1.3 MB on
// A, and nothing on B — but see ADR-059 before concluding the cap is too big,
// because that run never pushed @gmod/bam past its own budget.
//
// C is about the timeout rather than the budget. Four minutes clears @gmod/bam's
// 3-minute sweep but not this module's 15, which is the asymmetry ADR-059 argues
// for: C was 73.5 MB when the two matched, and is 0.0 MB now.
//
// Needs test_data/jb2bench_link and a built products/jbrowse-web; ADR-059 has the
// setup, since that directory is gitignored.
// Env: HEADLESS=0, TRACK, WINDOWS, WIN_KB, LABEL, SKIP_IDLE=1.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import {
  launchProfilingBrowser,
  mb,
  setupWorkerTracking,
  sleep,
} from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG = 'test_data/jb2bench_link/mem_config.json'
const ASSEMBLY = 'hg19mod'
const TRACK = process.env.TRACK || '1000x.shortread.bam'
const LABEL = process.env.LABEL || 'stock'
const WINDOWS = Number(process.env.WINDOWS || 12)
const WIN_KB = Number(process.env.WIN_KB || 12)

interface StressView {
  tracks: { configuration: { trackId: string } }[]
  hideTrack: (trackId: string) => void
  launchTrack: (trackId: string) => Promise<unknown>
  navToLocString: (loc: string) => void
}
type Win = { JBrowseSession?: { views?: StressView[] } }

// launchTrack, not showTrack: a display's state model is a dynamic import away
// until something asks for it, and this waits for that load before returning
function showTrack(page: Page, trackId: string) {
  return page.evaluate(async t => {
    await (window as unknown as Win).JBrowseSession?.views?.[0]?.launchTrack(t)
  }, trackId)
}

function navTo(page: Page, loc: string) {
  return page.evaluate(l => {
    ;(window as unknown as Win).JBrowseSession?.views?.[0]?.navToLocString(l)
  }, loc)
}

async function waitQuiet(page: Page) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout: 120000, polling: 250 },
    )
    .catch(() => {})
}

const { server, port } = await startServerOnFreePort(3406)
const { browser, page } = await launchProfilingBrowser()
const workers = await setupWorkerTracking(page)

// Bytes and request count for the data files only. Attributed by mapping
// requestId -> url on requestWillBeSent, so the app's own chunks and the config
// don't land in the totals.
interface Tally {
  bytes: number
  requests: number
}
const phases = new Map<string, Tally>()
let phase = 'startup'
const tally = () => {
  let t = phases.get(phase)
  if (!t) {
    t = { bytes: 0, requests: 0 }
    phases.set(phase, t)
  }
  return t
}
const urls = new Map<string, string>()
const isData = (url: string) => url.includes('jb2bench_link')

async function hookNetwork(session: CDPSession) {
  await session.send('Network.enable').catch(() => {})
  session.on('Network.requestWillBeSent', ({ requestId, request }) => {
    urls.set(requestId, request.url)
  })
  session.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const url = urls.get(requestId)
    if (url !== undefined && isData(url)) {
      const t = tally()
      t.bytes += encodedDataLength
      t.requests++
    }
    urls.delete(requestId)
  })
}
const hooked = new Set<CDPSession>()
async function hookWorkers() {
  for (const s of workers.values()) {
    if (!hooked.has(s)) {
      hooked.add(s)
      await hookNetwork(s)
    }
  }
}
await hookNetwork(await page.createCDPSession())

const spec = {
  views: [{ type: 'LinearGenomeView', assembly: ASSEMBLY, loc: 'chr22_mask' }],
}
await page.goto(
  `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=Budget`,
  { waitUntil: 'load', timeout: 120000 },
)
await waitQuiet(page)
await sleep(1500)

// Same windows every pass, so B and C are exact revisits of A.
const locs = Array.from({ length: WINDOWS }, (_, i) => {
  const start = 1 + Math.floor((i * 240000) / WINDOWS)
  return `chr22_mask:${start}-${start + WIN_KB * 1000}`
})

async function pan(name: string, order: string[]) {
  phase = name
  for (const loc of order) {
    await navTo(page, loc)
    await sleep(400)
    await waitQuiet(page)
    await hookWorkers()
  }
  await sleep(1500)
  const t = tally()
  console.log(
    `  ${name.padEnd(28)} ${mb(t.bytes).padStart(9)}  ${String(t.requests).padStart(4)} requests`,
  )
  return t
}

console.log(`label=${LABEL}  track=${TRACK}  ${WINDOWS} windows x ${WIN_KB} kb`)
phase = 'open'
await showTrack(page, TRACK)
await waitQuiet(page)
await hookWorkers()
await sleep(1500)

const a = await pan('A cold forward', locs)
const b = await pan('B warm reverse', [...locs].reverse())

if (process.env.SKIP_IDLE !== '1') {
  console.log('  ...idling 4 minutes so both caches sweep')
  for (let i = 0; i < 8; i++) {
    await sleep(30000)
  }
}
const c = await pan('C forward after idle', locs)

console.log(`\n=== ${LABEL} ===`)
console.log(`  A cold forward         ${mb(a.bytes)}  ${a.requests} requests`)
console.log(`  B warm reverse         ${mb(b.bytes)}  ${b.requests} requests`)
console.log(`  C forward after idle   ${mb(c.bytes)}  ${c.requests} requests`)

await browser.close()
server.close()
process.exit(0)
