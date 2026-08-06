// Chrome-level task trace for one screenshot spec: which thread ran which tasks,
// for how long, and where the gaps are. The last resort when a JS CPU profile
// says "idle" but the wall clock says otherwise — a sampling profiler only sees
// JS, while this sees the scheduler.
//
//   node scripts/trace-tasks.ts tcga/cohort_cnv_genome [--out=dir] [--timeout=ms]
//
// Writes the raw trace next to the report so it can be loaded in
// chrome://tracing / Perfetto for a visual read.
import fs from 'node:fs'
import path from 'node:path'

import {
  flagArg,
  openSpec,
  resolveUrlSpec,
  specViewport,
  withHarness,
} from './dev-harness.ts'
import { repoRoot } from './paths.ts'

const PORT = 3344

const timeout = Number(flagArg('timeout', '900000'))
const outDir = flagArg('out', path.join(repoRoot, 'perf-out'))

const spec = resolveUrlSpec(
  process.argv[2],
  'usage: node scripts/trace-tasks.ts <url-mode spec name>',
)

interface TraceEvent {
  name: string
  cat: string
  ph: string
  ts: number
  dur?: number
  pid: number
  tid: number
  args?: { name?: string; data?: { url?: string } }
}

function report(events: TraceEvent[]) {
  // thread_name metadata events label each (pid,tid)
  const names = new Map<string, string>()
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name) {
      names.set(`${e.pid}:${e.tid}`, e.args.name)
    }
  }
  const byThread = new Map<
    string,
    { busy: number; n: number; longest: number; slices: TraceEvent[] }
  >()
  for (const e of events) {
    if (e.ph === 'X' && e.dur !== undefined) {
      const key = `${e.pid}:${e.tid}`
      const cur = byThread.get(key) ?? {
        busy: 0,
        n: 0,
        longest: 0,
        slices: [],
      }
      // toplevel slices are the scheduler's own units of work; counting nested
      // slices too would multiply-count the same wall clock
      if (e.cat.includes('toplevel')) {
        cur.busy += e.dur
        cur.n += 1
        cur.longest = Math.max(cur.longest, e.dur)
      }
      cur.slices.push(e)
      byThread.set(key, cur)
    }
  }
  // a trace has millions of events, so min/max by reduce — Math.max(...ts)
  // overflows the call stack
  const span = (() => {
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const e of events) {
      if (e.ph === 'X') {
        lo = Math.min(lo, e.ts)
        hi = Math.max(hi, e.ts)
      }
    }
    return hi > lo ? (hi - lo) / 1e6 : 0
  })()
  console.log(`\ntrace span ${span.toFixed(1)}s\n`)
  console.log('| thread | toplevel busy | tasks | longest task |')
  console.log('| --- | --- | --- | --- |')
  for (const [key, v] of [...byThread.entries()]
    .sort((a, b) => b[1].busy - a[1].busy)
    .slice(0, 12)) {
    console.log(
      `| ${names.get(key) ?? key} | ${(v.busy / 1e6).toFixed(1)}s | ${v.n} | ${(v.longest / 1000).toFixed(0)}ms |`,
    )
  }
  // the biggest individual slices across every thread, whatever their category:
  // this is what names the actual cost when `toplevel` busy time is low
  const all = events
    .filter(e => e.ph === 'X' && (e.dur ?? 0) > 0)
    .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
  console.log('\n| dur | thread | slice |')
  console.log('| --- | --- | --- |')
  for (const e of all.slice(0, 25)) {
    const thread = names.get(`${e.pid}:${e.tid}`) ?? `${e.pid}:${e.tid}`
    console.log(
      `| ${((e.dur ?? 0) / 1000).toFixed(0)}ms | ${thread} | ${e.name}${e.args?.data?.url ? ` ${e.args.data.url.slice(0, 60)}` : ''} |`,
    )
  }
  // and the slice names that dominate in aggregate
  const byName = new Map<string, { ms: number; n: number }>()
  for (const e of all) {
    const cur = byName.get(e.name) ?? { ms: 0, n: 0 }
    cur.ms += (e.dur ?? 0) / 1000
    cur.n += 1
    byName.set(e.name, cur)
  }
  console.log('\n| total | n | slice name |')
  console.log('| --- | --- | --- |')
  for (const [name, v] of [...byName.entries()]
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 25)) {
    console.log(`| ${(v.ms / 1000).toFixed(1)}s | ${v.n} | ${name} |`)
  }
}

fs.mkdirSync(outDir, { recursive: true })

await withHarness(
  { port: PORT, protocolTimeout: timeout, viewport: specViewport(spec) },
  async ({ page }) => {
    const tracePath = path.join(
      outDir,
      `${spec.name.replaceAll('/', '_')}.trace.json`,
    )
    // Tracing lives on the CDP session in this puppeteer version; the browser
    // helper was removed. dataCollected frames are accumulated and written out
    // as a chrome://tracing-compatible file.
    const client = await page.createCDPSession()
    const collected: TraceEvent[] = []
    client.on('Tracing.dataCollected', (e: { value: TraceEvent[] }) => {
      collected.push(...e.value)
    })
    const tracingComplete = new Promise<void>(resolve => {
      client.once('Tracing.tracingComplete', () => {
        resolve()
      })
    })
    await client.send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: {
        includedCategories: [
          'toplevel',
          'devtools.timeline',
          'blink',
          'v8',
          'v8.execute',
          'disabled-by-default-v8.gc',
          'latency',
          'netlog',
        ],
      },
    })
    await openSpec(page, spec, PORT, timeout)
    await client.send('Tracing.end')
    await tracingComplete
    fs.writeFileSync(tracePath, JSON.stringify({ traceEvents: collected }))
    report(collected)
    console.log(`\ntrace: ${tracePath}`)
  },
)
