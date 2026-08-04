/* eslint-disable no-console */
// Tests whether the RPC worker's heap (dominated by grow-only bgzf WASM memory)
// stays inflated after navigating AWAY from a deep region + GC. If it does, a
// single deep BAM view permanently costs the worker hundreds of MB.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import {
  forceGc,
  heapUsage,
  heapUsageOrZero,
  launchProfilingBrowser,
  mb,
  navTo,
  setupWorkerTracking,
  sleep,
  sumHeapUsage,
  takeHeapSnapshot,
  waitRender,
} from './memHelpers.ts'
import { startServer } from './server.ts'

import type { CDPSession } from 'puppeteer'

const PORT = 3401

const CONFIG = 'test_data/jb2bench_link/mem_config.json'
const ASSEMBLY = 'hg19mod'
const TRACK = process.env.TRACK || '1000x.shortread.bam'
const DEEP = 'chr22_mask:124000-143000'
const EMPTY = 'chr22_mask:1-2000'

const server = await startServer(PORT)
const { browser, page } = await launchProfilingBrowser()
const workerSessions = await setupWorkerTracking(page)
const main = await page.createCDPSession()

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: ASSEMBLY,
      loc: DEEP,
      tracks: [TRACK],
    },
  ],
}
console.log(`track=${TRACK}`)
await page.goto(
  `http://localhost:${PORT}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=S`,
  { waitUntil: 'load', timeout: 120000 },
)

// Poll worker heap during load (NO forced GC) to catch the natural peak. Each
// tick awaits a CDP round-trip per target, so it re-arms itself on completion
// rather than running on an interval that would stack ticks on a busy renderer.
let peak = 0
let peakMain = 0
let polling = true
const pollPeak = async () => {
  while (polling) {
    const workers = await sumHeapUsage(workerSessions.values())
    const m = await heapUsageOrZero(main)
    peak = Math.max(peak, workers.used)
    peakMain = Math.max(peakMain, m.usedSize)
    await sleep(150)
  }
}
const polled = pollPeak()

await waitRender(page, 90000)
await sleep(2000)
polling = false
await polled
console.log(
  `workers=${workerSessions.size}  PEAK (no GC) main ${mb(peakMain)}  worker ${mb(peak)}`,
)

async function report(label: string) {
  await forceGc(main)
  for (const session of workerSessions.values()) {
    await forceGc(session)
  }
  await sleep(1000)
  const m = await heapUsage(main)
  const workers = await sumHeapUsage(workerSessions.values())
  console.log(
    `${label.padEnd(28)} main ${mb(m.usedSize).padStart(9)}  worker used ${mb(workers.used).padStart(9)} / reserved ${mb(workers.total).padStart(9)}`,
  )
}

await report('after deep load + GC')
await navTo(page, EMPTY, 500)
await sleep(1500)
await report('after nav→empty + GC')
await navTo(page, EMPTY, 500)
await sleep(1500)
await report('after 2nd empty + GC')

// Ground truth: heap snapshots DO count external ArrayBuffers (incl. WASM
// memory), unlike getHeapUsage. Sum the worker snapshot + report largest buffer.
async function snapshotTotal(session: CDPSession, label: string) {
  const snap = JSON.parse(await takeHeapSnapshot(session))
  const nf = snap.snapshot.meta.node_fields.length
  const sizeIdx = snap.snapshot.meta.node_fields.indexOf('self_size')
  const nodes: number[] = snap.nodes
  let total = 0
  let largest = 0
  for (let i = 0; i < nodes.length; i += nf) {
    total += nodes[i + sizeIdx]!
    largest = Math.max(largest, nodes[i + sizeIdx]!)
  }
  console.log(
    `${label.padEnd(28)} snapshot total ${mb(total)}  largest single node ${mb(largest)}`,
  )
}
for (const session of workerSessions.values()) {
  await snapshotTotal(session, 'worker snapshot after nav-away')
}

await browser.close()
server.close()
process.exit(0)
