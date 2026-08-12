/* eslint-disable no-console */
// What does BamAdapter's reference-sequence read cost, and is it really serial
// behind the whole alignment fetch?
//
// getFeatures awaits all of getRecordsForRange, THEN computes seqFetchSpan,
// THEN reads sequence -- so on a BAM whose reads carry no MD tag (which is what
// minimap2 and bwa emit unless asked otherwise, i.e. most long-read data) every
// query pays both round trips end to end. seqFetchSpan clamps its answer to
// [regionStart, regionEnd), so the queried region already bounds the read before
// any record has landed and the two could overlap.
//
// Measuring this on localhost reports ~1ms and means nothing: the cost is a
// round trip, not bytes. So this emulates latency (LATENCY_MS, default 60 --
// roughly a CDN) with throughput unthrottled, which isolates round trips from
// bandwidth. Run it at 0 too; the gap between the arms IS the answer.
//
// Reported as phases rather than a total, because the claim under test is about
// ORDER: if the reference phase starts after the BAM phase ends, it is on the
// critical path and overlapping it would remove its whole duration.
//
// The BASELINE, measured 2026-08-12 across latencies on the untiled fixture
// (one no-MD long-read track, 10 kb window). Serial in every arm — the
// reference read never once started before the last BAM byte landed:
//
//   RTT    bam phase   reference   gap    read    share
//     0ms       69ms   142->151    74ms     9ms      6%
//    20ms      148ms   182->218    34ms    36ms     17%
//    60ms      291ms   335->417    43ms    82ms     20%
//   150ms      651ms   707->895    56ms   188ms     21%
//
// The 0ms arm is the control and it is the one that says the cost is round
// trips rather than work: strip the latency and the reference read collapses to
// 9ms while the `gap` — JS that would still run — stays put.
//
// BOTH ARMS COME OUT OF ONE RUN, and the gate is what makes that possible: the
// prefetch only engages once the adapter has seen an MD-less read, so the first
// query is necessarily the unprefetched path and the pan is the prefetched one.
// Same build, same process, arms interleaved by construction. Three reps at
// 60ms, and they barely move:
//
//   FIRST LOAD (gate closed)   reference read 67ms, 0ms hidden — SERIAL
//                              critical path 663-698ms
//   PAN (gate open)            reference read 68ms, 68ms hidden — OVERLAPPED
//                              critical path 133-136ms vs 200-204ms serial
//                              equivalent = 1.50x
//
// The reference read is now entirely inside the alignment fetch. What that is
// worth depends on the ratio between them, which is why the two arms disagree
// and both are right: 10% of a first load (whose BAM phase is 8 requests) and
// 33% of a pan (2 requests). It is never negative — the read either hides or
// it doesn't.
//
// THE FIXTURE HAS TO BE TILED, and this took a wasted run to find out. With the
// original 255 KB hg19mod.fa the pan issues no reference request AT ALL: the
// reference is smaller than one 256 KiB RemoteFileWithRangeCache chunk, so the
// first query caches the whole genome. The only query that fixture shows the
// cost on is the one the gate excludes, so it can measure the baseline and
// never the fix. make-tiled-fixture.sh repeats chr22_mask into a 5 Mb contig
// and shifts a copy of every read into each tile — the reference tiles, so the
// copies still align against identical sequence and the mismatches stay real,
// with no read simulator involved.
//
// Build the fixture with make-tiled-fixture.sh, then write a
// tiled_config.json beside it with one IndexedFastaAdapter assembly over
// chr22_big.fa and one AlignmentsTrack over tiled.bam (fetchSizeLimit above the
// byte gate). percontext-probe.ts's header covers the traps shared with it —
// chiefly that jb2bench's own BAMs all carry MD, so the reference is never
// fetched on them and this whole question is invisible.
//
// TRACKS=1 by default: several tracks contend for RPC workers and connections,
// which blurs the phase boundary this is trying to see.
// Env: HEADLESS=0, TRACKS, LOC, PAN_LOC, LATENCY_MS, CONFIG, ASSEMBLY.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { launchProfilingBrowser, sleep } from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG = process.env.CONFIG || 'test_data/jb2bench_link/tiled_config.json'
const ASSEMBLY = process.env.ASSEMBLY || 'hg19big'
const LOC = process.env.LOC || 'chr22_big:100000..110000'
// Far from LOC, and far enough that the reference bases it needs are in a
// DIFFERENT 256 KiB RemoteFileWithRangeCache chunk. That is the whole reason
// the fixture is tiled — see the header. Also a cold @gmod/bam chunk.
const PAN_LOC = process.env.PAN_LOC || 'chr22_big:4000000..4010000'
const TRACKS = Number(process.env.TRACKS || 1)
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 60)

interface Timed {
  name: string
  start: number
  end: number
}

const timed: Timed[] = []
const pending = new Map<string, { name: string; start: number }>()

// Wall-clock from the probe rather than the CDP event timestamps: those come
// from several different target clocks (page and each worker) and are not
// comparable across targets, which is exactly the comparison being made here.
function now() {
  return performance.now()
}

async function instrument(session: CDPSession) {
  await session.send('Network.enable').catch(() => {})
  if (LATENCY_MS > 0) {
    await session
      .send('Network.emulateNetworkConditions', {
        offline: false,
        latency: LATENCY_MS,
        // unthrottled: the question is round trips, not bandwidth
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
      .catch(() => {})
  }
  session.on('Network.requestWillBeSent', ({ requestId, request }) => {
    pending.set(requestId, {
      name: request.url.split('/').pop() ?? request.url,
      start: now(),
    })
  })
  const finish = (requestId: string) => {
    const p = pending.get(requestId)
    if (p) {
      pending.delete(requestId)
      timed.push({ name: p.name, start: p.start, end: now() })
    }
  }
  session.on('Network.loadingFinished', ({ requestId }) => {
    finish(requestId)
  })
  session.on('Network.loadingFailed', ({ requestId }) => {
    finish(requestId)
  })
}

// Recursive, for the reason percontext-probe.ts documents: a bgzf pool worker is
// a worker inside a worker, and the alignment reads are issued from the RPC
// worker, so a page-only Network domain sees almost none of this.
async function attachAll(page: Page) {
  const attach = async (client: CDPSession) => {
    await client
      .send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      })
      .catch(() => {})
    client.on('Target.attachedToTarget', ({ targetInfo, sessionId }) => {
      if (targetInfo.type !== 'worker' && targetInfo.type !== 'shared_worker') {
        return
      }
      const session = client.connection()?.session(sessionId)
      if (session) {
        void attach(session)
        void instrument(session)
      }
    })
  }
  await attach(await page.createCDPSession())
}

function phase(match: (n: string) => boolean, after = -Infinity) {
  // `after` excludes the assembly's OWN sequence reads, which happen on the main
  // thread at startup to build the refname map — long before any adapter runs.
  // Counting those as part of the adapter's reference phase puts its start
  // before the BAM phase and reports a nonsensical overlap.
  const rows = timed.filter(t => match(t.name) && t.start >= after)
  if (rows.length === 0) {
    return undefined
  }
  return {
    n: rows.length,
    start: Math.min(...rows.map(r => r.start)),
    end: Math.max(...rows.map(r => r.end)),
  }
}

const { server, port } = await startServerOnFreePort(3420)
const { browser, page } = await launchProfilingBrowser()
await attachAll(page)
await instrument(await page.createCDPSession())

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: ASSEMBLY,
      loc: LOC,
      tracks: Array.from({ length: TRACKS }, (_, i) => `nomd${i + 1}`),
    },
  ],
}

console.log(
  `${TRACKS} no-MD track(s) at ${LOC}, emulated latency ${LATENCY_MS}ms`,
)
await page.goto(
  `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=SeqTiming`,
  { waitUntil: 'load', timeout: 300000 },
)
async function quiet() {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout: 300000, polling: 250 },
    )
    .catch(() => {})
  await sleep(20000)
}

// BOTH arms come out of ONE run, and the gate is what makes that possible.
// The prefetch only engages once the adapter has seen an MD-less read, so the
// FIRST query is necessarily the unprefetched path and the pan is the
// prefetched one — same build, same process, same browser, arms interleaved by
// construction rather than by a two-build A/B whose halves can drift.
//
// The pan has to land somewhere the reference is not already cached, or there
// is nothing to overlap; that is what the tiled fixture is for. See the header.
await quiet()
const firstLoad = [...timed]

timed.length = 0
pending.clear()
await page.evaluate(l => {
  ;(
    window as unknown as {
      JBrowseSession?: { views?: { navToLocString: (s: string) => void }[] }
    }
  ).JBrowseSession?.views?.[0]?.navToLocString(l)
}, PAN_LOC)
await quiet()
const pan = [...timed]

function report(label: string, rows: Timed[]) {
  const saved = timed.splice(0, timed.length, ...rows)
  const bam = phase(n => n.endsWith('.bam') || n.endsWith('.bam.bai'))
  const ref = bam ? phase(n => /\.fa$|\.fai$/.test(n), bam.start) : undefined
  console.log('')
  console.log(`--- ${label} ---`)
  if (!bam || !ref) {
    console.log(
      'WARNING: a phase is missing — the reference read only happens if the reads lack MD, the byte gate let the query run, and the reference is not already in the 256 KiB chunk cache. Check the fixture.',
    )
    timed.splice(0, timed.length, ...saved)
    return
  }
  const t0 = bam.start
  const rel = (t: number) => `${(t - t0).toFixed(0)}ms`
  console.log(
    `bam phase        ${rel(bam.start)} -> ${rel(bam.end)}   (${bam.n} req)`,
  )
  console.log(
    `reference phase  ${rel(ref.start)} -> ${rel(ref.end)}   (${ref.n} req)`,
  )
  const gap = ref.start - bam.end
  console.log(
    gap >= 0
      ? `SERIAL: reference starts ${gap.toFixed(0)}ms after the last BAM byte`
      : `OVERLAPPED: reference started ${(-gap).toFixed(0)}ms BEFORE the last BAM byte`,
  )
  // Split the reference read into the part that is HIDDEN behind the alignment
  // fetch and the part still EXPOSED on the critical path. That is the one
  // framing that reads correctly for both arms: a "% of query" figure assumes
  // the read is serial and goes negative — literally, -93% — the moment it
  // isn't, which is exactly the case being measured.
  const read = ref.end - ref.start
  // measured from where the read is still running past the BAM fetch, NOT from
  // bam.end — otherwise the JS gap between the two phases is counted as part of
  // the read and `exposed` comes out larger than the read itself
  const exposed = Math.max(0, ref.end - Math.max(ref.start, bam.end))
  const hidden = Math.max(0, read - exposed)
  const critical = Math.max(bam.end, ref.end) - bam.start
  console.log(
    `reference read   ${read.toFixed(0)}ms — ${hidden.toFixed(0)}ms hidden behind the alignment fetch, ${exposed.toFixed(0)}ms still on the critical path`,
  )
  console.log(
    `critical path    ${critical.toFixed(0)}ms   (serial equivalent ${(bam.end - bam.start + read).toFixed(0)}ms)`,
  )
  console.log('requests, ordered:')
  for (const t of [...rows].sort((a, b) => a.start - b.start)) {
    if (/\.(bam|bai|fa|fai)$/.test(t.name)) {
      console.log(
        `  ${(t.start - t0).toFixed(0).padStart(6)}ms  +${(t.end - t.start).toFixed(0).padStart(5)}ms  ${t.name}`,
      )
    }
  }
  timed.splice(0, timed.length, ...saved)
}

report('FIRST LOAD (gate closed — the unprefetched path)', firstLoad)
report('PAN (gate open — the prefetched path)', pan)

await browser.close()
server.close()
