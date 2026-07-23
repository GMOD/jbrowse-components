/* eslint-disable no-console */
// Memory / leak profiler for jbrowse-web.
//
//   node memprofile.ts snapshot [loc] [tracks] [renderer]
//     One-shot heap breakdown (per-target self_size by constructor + retainers).
//
//   node memprofile.ts leak [scenario]
//     Lifecycle churn + forced GC each round; reports the post-GC heap FLOOR and
//     DOM node/listener counts per round. A rising floor or unbounded node
//     growth across rounds = a real leak (transient garbage is collected away).
//
// Scenarios (leak mode): 'nav-local', 'nav-demo', 'view-churn'.
import {
  BASE_CHROME_ARGS,
  createTestServer,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import type { CDPSession, Page } from 'puppeteer'

const repoRoot = '/home/cdiesh/src/jbrowse-components'
const jbrowseWebRoot = `${repoRoot}/products/jbrowse-web`
const PORT = 3399
const mode = process.argv[2] || 'snapshot'
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

// ---- heap snapshot aggregation -------------------------------------------
function aggregateSnapshot(json: string) {
  const snap = JSON.parse(json)
  const meta = snap.snapshot.meta
  const nodeFields: string[] = meta.node_fields
  const nf = nodeFields.length
  const typeIdx = nodeFields.indexOf('type')
  const nameIdx = nodeFields.indexOf('name')
  const sizeIdx = nodeFields.indexOf('self_size')
  const typeEnum: string[] = meta.node_types[typeIdx]
  const nodes: number[] = snap.nodes
  const strings: string[] = snap.strings
  const bytes = new Map<string, number>()
  const counts = new Map<string, number>()
  let total = 0
  for (let i = 0; i < nodes.length; i += nf) {
    const key = `${typeEnum[nodes[i + typeIdx]!]} · ${strings[nodes[i + nameIdx]!] || '(anon)'}`
    const size = nodes[i + sizeIdx]!
    total += size
    bytes.set(key, (bytes.get(key) ?? 0) + size)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const rows = [...bytes.entries()]
    .map(([k, v]) => ({ name: k, bytes: v, count: counts.get(k)! }))
    .sort((a, b) => b.bytes - a.bytes)
  return { total, rows }
}

// Walk the largest individual nodes up their first-retainer chain to name who
// holds them.
function topRetainers(json: string, topN = 15) {
  const snap = JSON.parse(json)
  const meta = snap.snapshot.meta
  const nodeFields: string[] = meta.node_fields
  const edgeFields: string[] = meta.edge_fields
  const nf = nodeFields.length
  const ef = edgeFields.length
  const nTypeIdx = nodeFields.indexOf('type')
  const nNameIdx = nodeFields.indexOf('name')
  const nSizeIdx = nodeFields.indexOf('self_size')
  const nEdgeCountIdx = nodeFields.indexOf('edge_count')
  const eToIdx = edgeFields.indexOf('to_node')
  const nodeTypeEnum: string[] = meta.node_types[nTypeIdx]
  const nodes: number[] = snap.nodes
  const edges: number[] = snap.edges
  const strings: string[] = snap.strings
  const nodeCount = nodes.length / nf
  const edgeStart = new Uint32Array(nodeCount + 1)
  for (let i = 0; i < nodeCount; i++) {
    edgeStart[i + 1] = edgeStart[i]! + nodes[i * nf + nEdgeCountIdx]!
  }
  const parents = new Map<number, number>()
  for (let from = 0; from < nodeCount; from++) {
    const s = edgeStart[from]!
    const c = nodes[from * nf + nEdgeCountIdx]!
    for (let e = 0; e < c; e++) {
      const to = edges[(s + e) * ef + eToIdx]! / nf
      if (!parents.has(to)) {
        parents.set(to, from)
      }
    }
  }
  const name = (i: number) =>
    `${nodeTypeEnum[nodes[i * nf + nTypeIdx]!]}:${strings[nodes[i * nf + nNameIdx]!] || '(anon)'}`
  const idxs = [...Array(nodeCount).keys()].sort(
    (a, b) => nodes[b * nf + nSizeIdx]! - nodes[a * nf + nSizeIdx]!,
  )
  console.log('  top individual nodes → retainer chain:')
  for (const i of idxs.slice(0, topN)) {
    const chain = [name(i)]
    let cur = i
    for (let d = 0; d < 6; d++) {
      const p = parents.get(cur)
      if (p === undefined || p === cur) {
        break
      }
      chain.push(name(p))
      cur = p
    }
    console.log(
      `    ${mb(nodes[i * nf + nSizeIdx]!).padStart(9)}  ${chain.join(' ← ')}`,
    )
  }
}

async function takeSnapshot(session: CDPSession) {
  let buf = ''
  const onChunk = (e: { chunk: string }) => {
    buf += e.chunk
  }
  session.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await session.send('HeapProfiler.enable')
  if (process.env.NOGC !== '1') {
    await session.send('HeapProfiler.collectGarbage')
  }
  await session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  session.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  return buf
}

async function heapUsage(session: CDPSession) {
  await session.send('Runtime.enable')
  return session.send('Runtime.getHeapUsage')
}

async function forceGc(session: CDPSession) {
  await session.send('HeapProfiler.enable').catch(() => {})
  await session.send('HeapProfiler.collectGarbage').catch(() => {})
}

// ---- worker auto-attach ---------------------------------------------------
async function setupWorkerTracking(page: Page) {
  const workerSessions = new Map<string, CDPSession>()
  const client = await page.createCDPSession()
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  })
  client.on('Target.attachedToTarget', (e: any) => {
    const { targetInfo, sessionId } = e
    if (targetInfo.type === 'worker' || targetInfo.type === 'shared_worker') {
      const conn = (client as any).connection()
      const s = conn?.session(sessionId)
      if (s) {
        workerSessions.set(targetInfo.targetId, s)
      }
    }
  })
  return workerSessions
}

async function launch() {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== '0',
    protocolTimeout: 600000,
    args: [
      ...BASE_CHROME_ARGS,
      '--ignore-gpu-blocklist',
      '--enable-features=Vulkan',
      '--use-angle=gl',
      '--use-gl=angle',
      '--window-size=1400,900',
      '--js-flags=--expose-gc',
    ],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 800 })
  return { browser, page }
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
      { timeout: 60000, polling: 200 },
    )
    .catch(() => {})
}

async function navTo(page: Page, loc: string) {
  const input = 'input[placeholder="Search for location"]'
  await page.waitForSelector(input, { timeout: 20000 })
  await page.focus(input)
  await page.$eval(input, el => {
    el.value = ''
  })
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(input, loc)
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 300))
  await waitRender(page)
}

async function clickMenuItemByText(page: Page, text: string) {
  await page.evaluate(t => {
    const el = [...document.querySelectorAll('li,[role="menuitem"]')].find(e =>
      e.textContent?.includes(t),
    )
    ;(el as HTMLElement | undefined)?.click()
  }, text)
}

// Toggle a track's checkbox in the (already-open) track selector by its label.
async function toggleTrackByName(page: Page, name: string) {
  const changed = await page.evaluate(n => {
    const label = [...document.querySelectorAll('label')].find(l =>
      l.textContent?.includes(n),
    )
    const cb = label?.querySelector('input[type="checkbox"]') as
      | HTMLInputElement
      | undefined
    if (cb) {
      cb.click()
      return true
    }
    return false
  }, name)
  await new Promise(r => setTimeout(r, 600))
  await waitRender(page)
  return changed
}

// ---- leak scenarios -------------------------------------------------------
async function runLeak() {
  const scenario = process.argv[3] || 'nav-local'
  const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
  const { browser, page } = await launch()
  const workerSessions = await setupWorkerTracking(page)
  const main = await page.createCDPSession()

  const local = {
    config: 'test_data/volvox/config.json',
    assembly: 'volvox',
    tracks: ['Deep sequencing'],
    loci: ['ctgA:1-3000', 'ctgA:1-20000', 'ctgB:1-6000', 'ctgA:1000-2000'],
  }
  const demo = {
    config: 'test_data/config_demo.json',
    assembly: 'hg19',
    tracks: ['nanopore_targeted_alignments', 'volvox_sv_cram'],
    loci: [
      'chr7:55,080,000-55,120,000',
      'chr7:55,080,000-55,250,000',
      'chr7:55,200,000-55,240,000',
      'chr7:55,086,000-55,092,000',
    ],
  }
  const cfg = scenario === 'nav-demo' ? demo : local

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: cfg.assembly,
        loc: cfg.loci[0],
        tracks: cfg.tracks,
      },
    ],
  }
  const url = `http://localhost:${PORT}/?config=${cfg.config}&session=${encodeSessionSpec(spec)}&sessionName=Leak`
  console.log(`scenario=${scenario} config=${cfg.config}`)
  await page.goto(url, { waitUntil: 'load', timeout: 120000 })
  await waitRender(page)
  await new Promise(r => setTimeout(r, 2000))

  const floor = async (label: string) => {
    await forceGc(main)
    for (const [, s] of workerSessions) {
      await forceGc(s)
    }
    await new Promise(r => setTimeout(r, 800))
    const m = await heapUsage(main)
    let w = 0
    for (const [, s] of workerSessions) {
      w += (await heapUsage(s).catch(() => ({ usedSize: 0 }))).usedSize
    }
    const met = await page.metrics()
    console.log(
      `  ${label.padEnd(9)} main ${mb(m.usedSize).padStart(9)}  worker ${mb(w).padStart(9)}  ` +
        `nodes ${String(met.Nodes).padStart(6)}  listeners ${String(met.JSEventListeners).padStart(5)}  ` +
        `docs ${met.Documents}  ctxs ${met.Frames}`,
    )
  }

  if (scenario === 'view-churn') {
    // open the track selector once; rounds toggle the track off then on
    await page.click('[data-testid="view_menu_icon"]').catch(() => {})
    await new Promise(r => setTimeout(r, 400))
    await clickMenuItemByText(page, 'Open track selector')
    await new Promise(r => setTimeout(r, 1000))
    // filter to reveal the track (categories are collapsed by default)
    const filter = await page.evaluate(name => {
      const inp = [...document.querySelectorAll('input')].find(
        i =>
          i.getAttribute('placeholder')?.includes('Filter') ||
          i
            .closest('.MuiFormControl-root')
            ?.textContent?.includes('Filter tracks'),
      )
      if (inp) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!
        setter.call(inp, name)
        inp.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }
      return false
    }, cfg.tracks[0]!)
    console.log(`  filter input ${filter ? 'set' : 'NOT FOUND'}`)
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\n=== post-GC floor per round (rising floor / nodes = leak) ===')
  await floor('baseline')
  for (let round = 1; round <= 6; round++) {
    if (scenario === 'view-churn') {
      const off = await toggleTrackByName(page, cfg.tracks[0]!) // destroy display
      await new Promise(r => setTimeout(r, 500))
      await toggleTrackByName(page, cfg.tracks[0]!) // recreate display
      if (!off) {
        console.log('  (warn: track checkbox not found)')
      }
    } else {
      for (const loc of cfg.loci) {
        await navTo(page, loc)
        await new Promise(r => setTimeout(r, 400))
      }
    }
    await floor(`round ${round}`)
  }

  await browser.close()
  server.close()
}

// ---- one-shot snapshot ----------------------------------------------------
async function runSnapshot() {
  const config = process.env.CONFIG || 'test_data/volvox/config.json'
  const assembly = process.env.ASSEMBLY || 'volvox'
  const loc = process.env.LOC || process.argv[3] || 'ctgA:1-3000'
  const tracks = (
    process.env.TRACKS ||
    process.argv[4] ||
    'Deep sequencing'
  ).split(',')
  const renderer = process.env.RENDERER || process.argv[5] || 'webgl'
  const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
  const { browser, page } = await launch()
  const workerSessions = await setupWorkerTracking(page)

  const spec = {
    views: [{ type: 'LinearGenomeView', assembly, loc, tracks }],
  }
  const url = `http://localhost:${PORT}/?config=${config}&session=${encodeSessionSpec(spec)}&sessionName=Mem&renderer=${renderer}`
  console.log(
    `config=${config} loading ${assembly} ${loc} tracks=${tracks.join(',')} renderer=${renderer}`,
  )
  await page.goto(url, { waitUntil: 'load', timeout: 120000 })
  await waitRender(page)
  await new Promise(r => setTimeout(r, Number(process.env.SETTLE ?? 3000)))

  const main = await page.createCDPSession()
  console.log('\n=== JS heap usage per target ===')
  const targets: { label: string; s: CDPSession }[] = [
    { label: 'main', s: main },
  ]
  {
    const u = await heapUsage(main)
    console.log(
      `  ${mb(u.usedSize).padStart(9)} used / ${mb(u.totalSize).padStart(9)} total  main`,
    )
  }
  for (const [id, s] of workerSessions) {
    const u = await heapUsage(s)
    console.log(
      `  ${mb(u.usedSize).padStart(9)} used / ${mb(u.totalSize).padStart(9)} total  worker ${id.slice(0, 8)}`,
    )
    targets.push({ label: `worker ${id.slice(0, 8)}`, s })
  }
  for (const t of targets) {
    const json = await takeSnapshot(t.s)
    const agg = aggregateSnapshot(json)
    console.log(
      `\n=== ${t.label} — heap by constructor (total ${mb(agg.total)}) ===`,
    )
    for (const r of agg.rows.slice(0, 20)) {
      console.log(
        `  ${mb(r.bytes).padStart(9)}  ${String(r.count).padStart(8)}  ${r.name}`,
      )
    }
    topRetainers(json)
  }
  await browser.close()
  server.close()
}

if (mode === 'leak') {
  await runLeak()
} else {
  await runSnapshot()
}
process.exit(0)
