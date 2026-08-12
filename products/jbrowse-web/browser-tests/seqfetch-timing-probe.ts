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
// Measured 2026-08-12, one no-MD long-read track, 10 kb window. SERIAL in every
// arm — the reference read never once started before the last BAM byte landed:
//
//   RTT    bam phase   reference   gap    removable   share
//     0ms       69ms   142->151    74ms         9ms      6%
//    20ms      148ms   182->218    34ms        36ms     17%
//    60ms      291ms   335->417    43ms        82ms     20%
//   150ms      651ms   707->895    56ms       188ms     21%
//
// The 0ms arm is the control and it is the one that says the cost is round
// trips rather than work: strip the latency and the reference read collapses to
// 9ms while the `gap` — JS that would still run — stays put.
//
// Fixture and traps: see percontext-probe.ts's header (same fixture). TRACKS=1
// by default here -- several tracks contend for RPC workers and connections,
// which blurs the phase boundary this is trying to see.
// Env: HEADLESS=0, TRACKS, LOC, LATENCY_MS.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { launchProfilingBrowser, sleep } from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG = 'test_data/jb2bench_link/seqfetch_config.json'
const ASSEMBLY = 'hg19mod'
const LOC = process.env.LOC || 'chr22_mask:100000..110000'
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
await page
  .waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout: 300000, polling: 250 },
  )
  .catch(() => {})
await sleep(20000)

const bam = phase(n => n.endsWith('.bam') || n.endsWith('.bam.bai'))
const ref = bam
  ? phase(n => n === 'hg19mod.fa' || n === 'hg19mod.fa.fai', bam.start)
  : undefined

console.log('')
if (!bam || !ref) {
  console.log(
    'WARNING: a phase is missing — the reference read only happens if the reads lack MD and the byte gate let the query run. Check the fixture.',
  )
} else {
  const t0 = bam.start
  const rel = (t: number) => `${(t - t0).toFixed(0)}ms`
  console.log(
    `bam phase        ${rel(bam.start)} -> ${rel(bam.end)}   (${bam.n} req)`,
  )
  console.log(
    `reference phase  ${rel(ref.start)} -> ${rel(ref.end)}   (${ref.n} req)`,
  )
  const gap = ref.start - bam.end
  const tail = ref.end - bam.end
  const total = ref.end - bam.start
  console.log('')
  console.log(
    gap >= 0
      ? `SERIAL: the reference read starts ${gap.toFixed(0)}ms after the last BAM byte`
      : `OVERLAPPING by ${(-gap).toFixed(0)}ms — the serialization claim does not hold here`,
  )
  // Two numbers, and the difference between them matters. The TAIL is
  // everything after the last BAM byte, so it is the upper bound on what
  // overlapping could remove — but it includes `gap`, which is JS (the filter
  // loop, seqFetchSpan, building the sequence sub-adapter) and would still run.
  // REMOVABLE is the reference reads' own duration, which is what actually goes
  // away when they are issued alongside the alignment fetch instead of after it.
  const removable = ref.end - ref.start
  console.log(
    `tail (upper bound) ${tail.toFixed(0)}ms of ${total.toFixed(0)}ms = ${((tail / total) * 100).toFixed(0)}%   [includes ${gap.toFixed(0)}ms of JS that would still run]`,
  )
  console.log(
    `removable          ${removable.toFixed(0)}ms of ${total.toFixed(0)}ms = ${((removable / total) * 100).toFixed(0)}%   <- the reference reads themselves`,
  )
}

console.log('')
console.log('every request, ordered:')
for (const t of [...timed].sort((a, b) => a.start - b.start)) {
  if (/\.(bam|bai|fa|fai)$/.test(t.name)) {
    const t0 = timed.length ? Math.min(...timed.map(x => x.start)) : 0
    console.log(
      `  ${(t.start - t0).toFixed(0).padStart(6)}ms  +${(t.end - t.start).toFixed(0).padStart(5)}ms  ${t.name}`,
    )
  }
}

await browser.close()
server.close()
