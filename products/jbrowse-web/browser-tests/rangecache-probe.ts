/* eslint-disable no-console */
// Does RemoteFileWithRangeCache's chunk cache survive closing the track that
// filled it? memstress answers "does the floor rise" on volvox, whose entire
// dataset is a few MB — too small for this layer to show up as anything. This
// asks the one question directly, on data big enough to see it:
//
//   baseline (no alignments track) -> open a 105 MB BAM and pan it -> CLOSE the
//   track -> GC everywhere -> what is still held?
//
// Closing the track frees the BamAdapter (b4a353c163) and with it @gmod/bam's
// SharedReadCache, so anything left in the worker at step 4 is below that: the
// raw compressed bytes this module keeps. The heap snapshot pass attributes it,
// by counting buffers of exactly CHUNK_SIZE (262144) bytes, which is a shape
// nothing else in the stack allocates.
//
// Needs test_data/jb2bench_link and a built products/jbrowse-web; ADR-059 has the
// setup, since that directory is gitignored.
// Env: HEADLESS=0, TRACK, WINDOWS, WIN_KB, IDLE_MINUTES, SKIP_IDLE=1.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import {
  forceGc,
  heapUsageOrZero,
  launchProfilingBrowser,
  mb,
  setupWorkerTracking,
  sleep,
  sumHeapUsage,
} from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG = 'test_data/jb2bench_link/mem_config.json'
const ASSEMBLY = 'hg19mod'
const TRACK = process.env.TRACK || '1000x.shortread.bam'
const CHUNK_SIZE = 256 * 1024
// chr22_mask is 250001 bp; walk it in windows small enough to clear the
// adapter's fetchSizeLimit, so every window loads instead of banner-ing
const WINDOWS = Number(process.env.WINDOWS || 20)
const WIN_KB = Number(process.env.WIN_KB || 12)

interface StressView {
  tracks: { configuration: { trackId: string } }[]
  hideTrack: (trackId: string) => void
  launchTrack: (trackId: string) => Promise<unknown>
  navToLocString: (loc: string) => void
}

// Every page-side helper looks the view up itself. page.evaluate serializes the
// function it is given, so a shared `getView` defined out here is not in scope
// inside the page — it fails at runtime, not at typecheck.
type Win = { JBrowseSession?: { views?: StressView[] } }

// launchTrack, not showTrack: a display's state model is a dynamic import away
// until something asks for it, and this waits for that load before returning
function showTrack(page: Page, trackId: string) {
  return page.evaluate(async t => {
    await (window as unknown as Win).JBrowseSession?.views?.[0]?.launchTrack(t)
  }, trackId)
}

function hideTrack(page: Page, trackId: string) {
  return page.evaluate(t => {
    ;(window as unknown as Win).JBrowseSession?.views?.[0]?.hideTrack(t)
  }, trackId)
}

function navTo(page: Page, loc: string) {
  return page.evaluate(l => {
    ;(window as unknown as Win).JBrowseSession?.views?.[0]?.navToLocString(l)
  }, loc)
}

function trackCount(page: Page) {
  return page
    .evaluate(
      () =>
        (window as unknown as Win).JBrowseSession?.views?.[0]?.tracks.length ??
        -1,
    )
    .catch(() => -1)
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

const { server, port } = await startServerOnFreePort(3405)
const { browser, page } = await launchProfilingBrowser()
const workers = await setupWorkerTracking(page)
const main = await page.createCDPSession()

const errors: string[] = []
page.on('pageerror', e => {
  errors.push(String(e))
})

// Bytes actually pulled over the wire, so the retained figure below can be
// compared against something rather than asserted on its own. Counted on the
// WORKER targets as well as the page: the alignments fetches are issued from the
// worker, and a page-only Network domain misses every one of them — which reads
// as "2 MB fetched" next to a 300 MB worker heap.
let wireBytes = 0
const countBytes = async (session: CDPSession) => {
  await session.send('Network.enable').catch(() => {})
  session.on('Network.loadingFinished', ({ encodedDataLength }) => {
    wireBytes += encodedDataLength
  })
}
await countBytes(await page.createCDPSession())
// Workers boot lazily, on the first RPC call, so this has to be re-run after the
// track opens rather than once up front.
const hooked = new Set<CDPSession>()
async function hookWorkers() {
  for (const s of workers.values()) {
    if (!hooked.has(s)) {
      hooked.add(s)
      await countBytes(s)
    }
  }
}

// Start with NO alignments track: the baseline has to include a booted worker
// pool and a loaded app, or it would be measuring startup rather than retention.
const spec = {
  views: [{ type: 'LinearGenomeView', assembly: ASSEMBLY, loc: 'chr22_mask' }],
}
await page.goto(
  `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=RangeCache`,
  { waitUntil: 'load', timeout: 120000 },
)
await waitQuiet(page)
await sleep(2000)

async function floor(label: string) {
  await forceGc(main)
  for (const s of workers.values()) {
    await forceGc(s)
  }
  await sleep(900)
  const m = await heapUsageOrZero(main)
  const w = await sumHeapUsage(workers.values())
  const openTracks = await trackCount(page)
  console.log(
    `  ${label.padEnd(26)} main ${mb(m.usedSize).padStart(9)}  worker ${mb(w.used).padStart(9)}` +
      `  wkrs ${workers.size}  tracks ${openTracks}  wire ${mb(wireBytes)}`,
  )
  return { main: m.usedSize, worker: w.used }
}

/**
 * Sum every node's `self_size` in a worker's heap snapshot, and count the ones
 * that are exactly CHUNK_SIZE bytes.
 *
 * Two reasons this parses the stream rather than JSON.parse-ing it, the way
 * memsticky does: a 300 MB heap serializes to more than V8's maximum string
 * length, so buffering it throws `Invalid string length` outright — and
 * `Runtime.getHeapUsage` (what `floor` reports) does NOT count external
 * ArrayBuffer memory, which is exactly where 256 KB chunks live. The snapshot is
 * the only instrument here that sees them at all.
 *
 * The nodes array is a flat run of integers with no nesting, so the first `]`
 * after it ends it and a split on commas is a correct tokenizer.
 */
function snapshotStats(label: string, session: CDPSession = firstWorker()) {
  return new Promise<{ total: number; exactBytes: number; exact: number }>(
    (resolve, reject) => {
      let head = ''
      let nf = 0
      let sizeIdx = -1
      let field = 0
      let carry = ''
      let done = false
      let total = 0
      let exact = 0

      const take = (part: string) => {
        if (field === sizeIdx) {
          const size = Number(part)
          total += size
          if (size === CHUNK_SIZE) {
            exact++
          }
        }
        field = (field + 1) % nf
      }

      const onChunk = ({ chunk }: { chunk: string }) => {
        if (done) {
          return
        }
        let rest = chunk
        if (sizeIdx < 0) {
          head += chunk
          const at = head.indexOf('"nodes":[')
          if (at < 0) {
            return
          }
          const meta = /"node_fields":\[([^\]]*)\]/.exec(head)
          if (!meta) {
            reject(new Error('no node_fields in snapshot header'))
            return
          }
          const fields = meta[1]!.split(',').map(s => s.replaceAll('"', ''))
          nf = fields.length
          sizeIdx = fields.indexOf('self_size')
          rest = head.slice(at + '"nodes":['.length)
          head = ''
        }
        const end = rest.indexOf(']')
        const body = end < 0 ? rest : rest.slice(0, end)
        const parts = (carry + body).split(',')
        carry = end < 0 ? parts.pop()! : ''
        for (const part of parts) {
          take(part)
        }
        if (end >= 0) {
          done = true
          session.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
          const exactBytes = exact * CHUNK_SIZE
          console.log(
            `  ${label.padEnd(26)} snapshot ${mb(total).padStart(9)}  ` +
              `${String(exact).padStart(5)} nodes of exactly ${CHUNK_SIZE} B = ${mb(exactBytes)}`,
          )
          resolve({ total, exactBytes, exact })
        }
      }

      session.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
      void session
        .send('HeapProfiler.enable')
        .then(() => session.send('HeapProfiler.collectGarbage'))
        .then(() =>
          session.send('HeapProfiler.takeHeapSnapshot', {
            reportProgress: false,
          }),
        )
        .catch(reject)
    },
  )
}

function firstWorker() {
  const s = workers.values().next().value
  if (!s) {
    throw new Error('no worker attached')
  }
  return s
}

console.log(`track=${TRACK}  ${WINDOWS} windows x ${WIN_KB} kb`)
await floor('baseline (no worker yet)')

// The comparison that matters is against a worker that has BOOTED and read the
// index — before it has been panned across the file. Measuring against the
// no-track baseline would fold worker startup into the retention figure.
await showTrack(page, TRACK)
await waitQuiet(page)
await hookWorkers()
await sleep(1500)
const base = await floor('track open, before pan')
const beforePan = await snapshotStats('worker, before pan')

// Pan across the contig. Each window is a distinct byte range, so the chunk
// cache accumulates rather than re-hitting.
for (let i = 0; i < WINDOWS; i++) {
  const start = 1 + Math.floor((i * 240000) / WINDOWS)
  await navTo(page, `chr22_mask:${start}-${start + WIN_KB * 1000}`)
  await sleep(400)
  await waitQuiet(page)
}
await sleep(1500)
const open = await floor('after pan, track open')
const panSnapshot = await snapshotStats('worker, after pan')

// Don't read the "after CLOSING" row as a clean close-time measurement: the
// snapshot above streams over a gigabyte of JSON and can take minutes, which
// makes it an uncontrolled idle period. Runs where it overran @gmod/bam's
// 3-minute sweep report a worker that had already dropped its parsed cache
// before the close, and runs where it didn't report one that hadn't. The rows
// that mean something are the peak and the post-idle one.
await hideTrack(page, TRACK)
await sleep(2000)
await waitQuiet(page)
const closed = await floor('after CLOSING track')

// The tab-away lifecycle, which is where a visibilitychange sweep would fire.
await page.evaluate(() => {
  Object.defineProperties(document, {
    hidden: { configurable: true, get: () => true },
    visibilityState: { configurable: true, get: () => 'hidden' },
  })
  document.dispatchEvent(new Event('visibilitychange'))
})
await sleep(3000)
const hidden = await floor('after tab hidden')

// Wait out BOTH idle sweeps before reading the residue. They are not the same
// length on purpose (ADR-059): @gmod/bam's parsed cache goes at three minutes,
// this module's raw chunks at fifteen, because raw bytes are the cheap layer and
// the only one still helping once the parsed cache has expired. So the default
// here has to clear fifteen plus a sweep interval, or it reports a cache that is
// simply not due yet as one that never reclaims.
//
// Dropping the adapterCache key does NOT make a BamFile collectable at once
// either: SharedReadCache runs its sweep on a setInterval whose callback closes
// over the cache, and a pending timer is a GC root — so the parsed chunks stay
// reachable through the timer until that sweep empties the cache and stops
// itself.
const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 19)
if (process.env.SKIP_IDLE !== '1') {
  console.log(`  ...waiting out ${IDLE_MINUTES} min of idle sweeps`)
  for (let i = 0; i < IDLE_MINUTES * 2; i++) {
    await sleep(30000)
  }
}
const idle = await floor(`after ${IDLE_MINUTES} min idle`)

console.log('\n=== attribution (heap snapshots) ===')
const afterPan = panSnapshot
const afterClose = await snapshotStats('worker, after close+idle')
const mainClose = await snapshotStats('main thread, after close+idle', main)

console.log('\n=== summary ===')
console.log(`  wire bytes fetched        ${mb(wireBytes)}`)
console.log(`  worker heap, track open   ${mb(open.worker)}`)
console.log(`  worker heap, track closed ${mb(closed.worker)}`)
console.log(`  worker heap, tab hidden   ${mb(hidden.worker)}`)
console.log(
  `  worker heap, +${IDLE_MINUTES} min idle ${mb(idle.worker).padStart(9)}`,
)
console.log(`  RETAINED after close+idle ${mb(idle.worker - base.worker)}`)
console.log(
  `  CHUNK_SIZE bufs  before pan ${mb(beforePan.exactBytes)}  ` +
    `after pan ${mb(afterPan.exactBytes)}  after close+idle ${mb(afterClose.exactBytes)}`,
)
console.log(
  `  snapshot total   before pan ${mb(beforePan.total)}  ` +
    `after pan ${mb(afterPan.total)}  after close+idle ${mb(afterClose.total)}`,
)
console.log(`  main heap Δ after close    ${mb(closed.main - base.main)}`)
console.log(
  `  main thread CHUNK_SIZE bufs ${mb(mainClose.exactBytes)} — the alignments ` +
    'fetches are issued from the worker, so this instance is expected to be empty',
)
console.log(`  page errors: ${errors.length}`)
for (const e of errors.slice(0, 5)) {
  console.log(`    ! ${e}`)
}

await browser.close()
server.close()
process.exit(0)
