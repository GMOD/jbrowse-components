/* eslint-disable no-console */
// Tests whether the RPC worker's heap (dominated by grow-only bgzf WASM memory)
// stays inflated after navigating AWAY from a deep region + GC. If it does, a
// single deep BAM view permanently costs the worker hundreds of MB.
import {
  BASE_CHROME_ARGS,
  createTestServer,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import puppeteer, { type CDPSession, type Page } from 'puppeteer'

const repoRoot = '/home/cdiesh/src/jbrowse-components'
const jbrowseWebRoot = `${repoRoot}/products/jbrowse-web`
const PORT = 3401
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

const CONFIG = 'test_data/jb2bench_link/mem_config.json'
const ASSEMBLY = 'hg19mod'
const TRACK = process.env.TRACK || '1000x.shortread.bam'
const DEEP = 'chr22_mask:124000-143000'
const EMPTY = 'chr22_mask:1-2000'

const workerSessions = new Map<string, CDPSession>()

async function heapUsage(s: CDPSession) {
  await s.send('Runtime.enable')
  return s.send('Runtime.getHeapUsage')
}
async function gc(s: CDPSession) {
  await s.send('HeapProfiler.enable').catch(() => {})
  await s.send('HeapProfiler.collectGarbage').catch(() => {})
}

async function waitRender(page: Page) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-testid$="-done"],[data-testid$="_done"]',
        ).length > 0 &&
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
          0,
      { timeout: 90000, polling: 200 },
    )
    .catch(() => {})
}
async function navTo(page: Page, loc: string) {
  const input = 'input[placeholder="Search for location"]'
  await page.waitForSelector(input, { timeout: 20000 })
  await page.focus(input)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(input, loc)
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 500))
  await waitRender(page)
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
const client = await page.createCDPSession()
await client.send('Target.setAutoAttach', {
  autoAttach: true,
  waitForDebuggerOnStart: false,
  flatten: true,
})
client.on('Target.attachedToTarget', (e: any) => {
  const { targetInfo, sessionId } = e
  if (targetInfo.type === 'worker') {
    const s = (client as any).connection()?.session(sessionId)
    if (s) {
      workerSessions.set(targetInfo.targetId, s)
    }
  }
})
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

// Poll worker heap during load (NO forced GC) to catch the natural peak.
let peak = 0
let peakMain = 0
const poll = setInterval(() => {
  void (async () => {
    let wu = 0
    for (const [, s] of workerSessions) {
      wu += (await heapUsage(s).catch(() => ({ usedSize: 0 }))).usedSize
    }
    const m = (await heapUsage(main).catch(() => ({ usedSize: 0 }))).usedSize
    peak = Math.max(peak, wu)
    peakMain = Math.max(peakMain, m)
  })()
}, 150)

await waitRender(page)
await new Promise(r => setTimeout(r, 2000))
clearInterval(poll)
console.log(
  `workers=${workerSessions.size}  PEAK (no GC) main ${mb(peakMain)}  worker ${mb(peak)}`,
)

async function report(label: string) {
  await gc(main)
  for (const [, s] of workerSessions) {
    await gc(s)
  }
  await new Promise(r => setTimeout(r, 1000))
  const m = await heapUsage(main)
  let wu = 0
  let wt = 0
  for (const [, s] of workerSessions) {
    const u = await heapUsage(s).catch(() => ({ usedSize: 0, totalSize: 0 }))
    wu += u.usedSize
    wt += u.totalSize
  }
  console.log(
    `${label.padEnd(28)} main ${mb(m.usedSize).padStart(9)}  worker used ${mb(wu).padStart(9)} / reserved ${mb(wt).padStart(9)}`,
  )
}

await report('after deep load + GC')
await navTo(page, EMPTY)
await new Promise(r => setTimeout(r, 1500))
await report('after nav→empty + GC')
await navTo(page, EMPTY)
await new Promise(r => setTimeout(r, 1500))
await report('after 2nd empty + GC')

// Ground truth: heap snapshots DO count external ArrayBuffers (incl. WASM
// memory), unlike getHeapUsage. Sum the worker snapshot + report largest buffer.
async function snapshotTotal(s: CDPSession, label: string) {
  let buf = ''
  const onChunk = (e: { chunk: string }) => {
    buf += e.chunk
  }
  s.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await s.send('HeapProfiler.enable')
  await s.send('HeapProfiler.collectGarbage')
  await s.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  s.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  const snap = JSON.parse(buf)
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
for (const [, s] of workerSessions) {
  await snapshotTotal(s, 'worker snapshot after nav-away')
}

await browser.close()
server.close()
process.exit(0)
