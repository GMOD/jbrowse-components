/* eslint-disable no-console */
// Three things in this stack are scoped per JS CONTEXT, and adapters are sticky
// per track to one of up to five RPC workers. So each of the three multiplies by
// however many workers a session spreads its tracks over. This asks, on a real
// production build, which of them actually multiply and by how much:
//
//   1. the BGZF inflate pool     (getSharedWorkerPool memoizes per context)
//   2. RemoteFileWithRangeCache  (module-global `cache` Map, per context)
//   3. the parsed-chunk budget   (SharedBudget, per context -- ADR-064)
//
// (3) is defensible: a worker OOMs on its own heap, so per-worker is the scope
// that matters. (1) and (2) bound machine-wide resources -- threads and the
// network -- from inside a context that cannot see the others, and both were
// measured multiplying. See reference/BAM_STACK_INTEGRATION.md.
//
// The fixture is N alignments tracks with DISTINCT adapter configs (N names for
// one file), because rpcSessionId is adapterConfigCacheKey(adapter): identical
// configs collapse to one sticky worker and one adapter, which is the
// multiplication being measured. Their reads carry no MD tag, so every one of
// them fetches reference bases -- the same hg19mod.fa, from N contexts.
//
// Run TRACKS above the RPC pool size (which is clamp(cores - 1, 1, 5)): that is
// the control that separates "per track", which would be unavoidable, from "per
// context", which is the finding. Measured 2026-08-12 on 16 cores:
//
//   tracks   RPC workers   pool workers   hg19mod.fa fetches
//        1             1              4                    1
//        5             5             20                    5
//        8             5             20                    5
//
// FIXTURE (gitignored, so it has to be rebuilt):
//   samtools view --remove-tag MD -b -o nomd.bam <a long-read BAM>
//   samtools index nomd.bam
//   copy it to test_data/jb2bench_link/nomd1.bam (+ .bai) and hard-link
//   nomd2..N beside it -- the test server resolves realpath and 404s a symlink
//   pointing outside its root. Copy hg19mod.fa/.fai in from jb2bench, and write
//   seqfetch_config.json with one IndexedFastaAdapter assembly and N
//   AlignmentsTracks, each with a distinct bamLocation uri and a fetchSizeLimit
//   above the byte gate (a 10 kb window on 200x long-read estimates 33 MB).
//
// Needs a built products/jbrowse-web. Env: HEADLESS=0, TRACKS, LOC.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { launchProfilingBrowser, sleep } from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG = 'test_data/jb2bench_link/seqfetch_config.json'
const ASSEMBLY = 'hg19mod'
const REFERENCE = 'hg19mod.fa'
const LOC = process.env.LOC || 'chr22_mask:100000..110000'
const TRACKS = Number(process.env.TRACKS || 5)

interface Win {
  JBrowseSession?: {
    views?: { tracks: unknown[]; initialized?: boolean }[]
  }
}

interface WorkerInfo {
  url: string
  session: CDPSession
}

// Requests by file, counted on the page AND on every worker session. The
// alignments and sequence reads are issued from the workers, so a page-only
// Network domain sees essentially none of them. Counts are the robust number
// here, not bytes: a repeat that the browser's own HTTP cache absorbs still
// shows as a request issued but reports zero encodedDataLength, and which of
// them it absorbs varied between otherwise identical runs.
const requests = new Map<string, { count: number; bytes: number }>()
const pending = new Map<string, string>()

async function countOn(session: CDPSession) {
  await session.send('Network.enable').catch(() => {})
  session.on('Network.requestWillBeSent', ({ requestId, request }) => {
    pending.set(requestId, request.url)
  })
  session.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const url = pending.get(requestId)
    if (url === undefined) {
      return
    }
    pending.delete(requestId)
    const name = url.split('/').pop() ?? url
    const entry = requests.get(name) ?? { count: 0, bytes: 0 }
    entry.count++
    entry.bytes += encodedDataLength
    requests.set(name, entry)
  })
}

// Every worker the page spawns, and every worker THOSE spawn — the bgzf pool is
// a worker created inside an RPC worker, so a single-level auto-attach (which is
// what memHelpers' setupWorkerTracking does) sees the RPC workers and none of
// the pool. Recording the url is the whole point: `blob:` is the pool,
// everything else is an RPC worker.
async function trackWorkersDeep(page: Page) {
  const seen = new Map<string, WorkerInfo>()
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
      if (!session) {
        return
      }
      seen.set(targetInfo.targetId, { url: targetInfo.url, session })
      void attach(session)
      void countOn(session)
    })
    client.on('Target.detachedFromTarget', ({ targetId }) => {
      if (targetId !== undefined) {
        seen.delete(targetId)
      }
    })
  }
  await attach(await page.createCDPSession())
  return seen
}

async function waitQuiet(page: Page) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout: 180000, polling: 250 },
    )
    .catch(() => {})
}

const { server, port } = await startServerOnFreePort(3410)
const { browser, page } = await launchProfilingBrowser()
const seen = await trackWorkersDeep(page)
await countOn(await page.createCDPSession())

const errors: string[] = []
page.on('pageerror', e => {
  errors.push(String(e))
})

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

console.log(`loading ${TRACKS} no-MD alignments tracks at ${LOC}`)
await page.goto(
  `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=PerContext`,
  { waitUntil: 'load', timeout: 180000 },
)
await waitQuiet(page)

// Sample as it settles rather than once. The reference read is issued AFTER
// getRecordsForRange resolves — that serialization is its own finding — so a
// single early sample sees the BAM chunks and none of the reference reads,
// which is exactly what the first run of this reported.
console.log('settling:')
for (const ms of [5000, 10000, 15000, 15000]) {
  await sleep(ms)
  const bam = [...requests].filter(([n]) => n.endsWith('.bam'))
  console.log(
    `  +${String(ms / 1000).padStart(2)}s  bam ${(bam.reduce((a, [, v]) => a + v.bytes, 0) / 1024 / 1024).toFixed(1)} MB in ${bam.reduce((a, [, v]) => a + v.count, 0)} req   ${REFERENCE} ${requests.get(REFERENCE)?.count ?? 0} req`,
  )
}

const view = await page
  .evaluate(() => {
    const v = (window as unknown as Win).JBrowseSession?.views?.[0]
    return { tracks: v?.tracks.length ?? -1, initialized: !!v?.initialized }
  })
  .catch(() => ({ tracks: -1, initialized: false }))

const workers = [...seen.values()]
const pool = workers.filter(w => w.url.startsWith('blob:'))
const rpc = workers.filter(w => !w.url.startsWith('blob:'))

console.log('')
console.log(
  `open tracks                 ${view.tracks} of ${TRACKS} (initialized ${view.initialized})`,
)
console.log(`RPC workers booted          ${rpc.length}`)
console.log(
  `bgzf pool workers (blob:)   ${pool.length}  = ${rpc.length} x ${rpc.length ? (pool.length / rpc.length).toFixed(1) : '-'}`,
)
console.log('')
console.log('requests by file:')
for (const [name, { count, bytes }] of [...requests].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  if (/\.(bam|fa|fai|bai)$/.test(name)) {
    console.log(
      `  ${name.padEnd(22)} ${String(count).padStart(3)} req  ${(bytes / 1024).toFixed(0)} KB`,
    )
  }
}
console.log('')
console.log(
  `${REFERENCE} fetched ${requests.get(REFERENCE)?.count ?? 0}x for ${TRACKS} tracks over ${rpc.length} RPC workers`,
)
if (view.tracks !== TRACKS || !view.initialized) {
  console.log(
    '\nWARNING: not every track opened — check the byte gate (fetchSizeLimit) and the fixture paths before believing any number above',
  )
}
if (errors.length) {
  console.log(
    `\npage errors: ${errors.length}\n${errors.slice(0, 3).join('\n')}`,
  )
}

await browser.close()
server.close()
