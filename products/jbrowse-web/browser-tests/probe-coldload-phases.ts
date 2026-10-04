/* eslint-disable no-console */
// Where a cold load to an alignments track's first paint spends its time: one
// Chrome trace per load across the page and its workers, milestones from a
// MutationObserver, CPU samples resolved through the build's source maps.
//
//   node browser-tests/probe-coldload-phases.ts capture [--runs=5]
//     [--renderer=canvas2d|webgl] [--arms=base,nothrottle,suspense]
//     [--set=light|heavy] [--only=bam,cram] [--phases=cold,warm] [--out=dir]
//   node browser-tests/probe-coldload-phases.ts analyze <trace.json>...
//   node browser-tests/probe-coldload-phases.ts inclusive <trace.json> <fromMs>
//     <toMs> main|worker [topN]
//
// Arms: `nothrottle` collapses React 19's Suspense reveal throttle, which
// holds a retry commit until 300ms after the last fallback commit through
// setTimeout(completeRootWhenReady.bind(...), ms), so the A/B prices it with no
// app change. `suspense` logs every boundary that shows a fallback and when it
// reveals, through a fake devtools hook.
//
// `--set=heavy` reads build/bench/config.json and the jb2bench corpus files it
// names, copied in beside it by hand; the light set is volvox.
import fs from 'node:fs'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { createFrameResolver } from './frameResolver.ts'
import { startServer } from './server.ts'

import type { Frame } from './frameResolver.ts'

const flag = (n: string) =>
  process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const list = (n: string, fallback: string) => (flag(n) ?? fallback).split(',')
const PORT = 3361
const DRAWN = '[data-display-drawn="true"]'

interface Scenario {
  config: string
  spec: object
  wait: string
}

const lgv = (
  config: string,
  assembly: string,
  loc: string,
  tracks: string[],
) => ({
  config,
  spec: { views: [{ type: 'LinearGenomeView', assembly, loc, tracks }] },
  wait: tracks.length ? DRAWN : '[data-app-phase="ready"]',
})
const volvox = (tracks: string[]) =>
  lgv('test_data/volvox/config.json', 'volvox', 'ctgA:1-20000', tracks)
const bench = (assembly: string, loc: string, track: string) =>
  lgv('bench/config.json', assembly, loc, [track])

const W19 = 'chr22_mask:124000-143000'
const W100 = 'chr22_mask:75000-175000'
const W1M = 'chr22_2mb:500001-1500000'

const SETS: Record<string, Record<string, Scenario>> = {
  light: {
    emptylgv: volvox([]),
    bam: volvox(['volvox_bam']),
    cram: volvox(['volvox_cram']),
  },
  heavy: {
    s200bam100k: bench('hg19mod', W100, '200x.shortread.bam'),
    s200cram100k: bench('hg19mod', W100, '200x.shortread.cram'),
    s1000bam19k: bench('hg19mod', W19, '1000x.shortread.bam'),
    s1000cram19k: bench('hg19mod', W19, '1000x.shortread.cram'),
    l200bam19k: bench('hg19mod', W19, '200x.longread.bam'),
    l200cram19k: bench('hg19mod', W19, '200x.longread.cram'),
    m100bam1m: bench('chr22_2mb', W1M, '2mb.100x.shortread.bam'),
    m100cram1m: bench('chr22_2mb', W1M, '2mb.100x.shortread.cram'),
  },
}

const MILESTONES = ['rootChild', 'displayMounted', 'drawn', 'appReady']

function installMarkers() {
  const t: Record<string, number> = {}
  ;(window as any).__ms = t
  const mark = (n: string) => {
    if (!(n in t)) {
      t[n] = performance.now()
      performance.mark(`jb:${n}`)
    }
  }
  new MutationObserver(() => {
    if (document.querySelector('#root *')) {
      mark('rootChild')
    }
    if (document.querySelector('[data-display-drawn]')) {
      mark('displayMounted')
    }
    if (document.querySelector('[data-display-drawn="true"]')) {
      mark('drawn')
    }
    if (document.querySelector('[data-app-phase="ready"]')) {
      mark('appReady')
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-display-drawn', 'data-app-phase'],
  })
}

function collapseSuspenseThrottle() {
  const orig = window.setTimeout
  const hits: number[][] = []
  ;(window as any).__throttled = hits
  ;(window as any).setTimeout = (fn: any, ms?: number, ...rest: any[]) => {
    const throttled =
      typeof fn === 'function' &&
      fn.name.startsWith('bound ') &&
      ms !== undefined &&
      ms > 10 &&
      ms <= 300
    if (throttled) {
      hits.push([Math.round(performance.now()), ms])
    }
    return orig(fn, throttled ? 0 : ms, ...rest)
  }
}

function logSuspenseBoundaries() {
  const log: unknown[] = []
  ;(window as any).__suspense = log
  const shown = new Map<any, number>()
  const label = (f: any) => {
    const names: string[] = []
    for (let p = f.return; p && names.length < 6; p = p.return) {
      const t = p.type
      const testId = p.memoizedProps?.['data-testid']
      const n =
        typeof t === 'string'
          ? testId
            ? `${t}[${testId}]`
            : ''
          : t?.displayName || t?.name || ''
      if (n) {
        names.push(n)
      }
    }
    return names.join('<')
  }
  ;(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id: unknown, root: any) {
      const now = Math.round(performance.now())
      const visit = (f: any) => {
        for (let x = f; x; x = x.sibling) {
          if (x.tag === 13) {
            const key = x.alternate && shown.has(x.alternate) ? x.alternate : x
            const showing = x.memoizedState !== null
            if (showing && !shown.has(key)) {
              shown.set(key, now)
              log.push(['show', now, label(x)])
            } else if (!showing && shown.has(key)) {
              log.push(['reveal', now, now - shown.get(key)!, label(x)])
              shown.delete(key)
            }
          }
          if (x.child) {
            visit(x.child)
          }
        }
      }
      visit(root.current)
    },
  }
}

const median = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]

async function capture() {
  const out = flag('out') ?? '/tmp/coldload'
  const runs = Number(flag('runs') ?? 5)
  const renderer = flag('renderer') ?? 'canvas2d'
  const only = flag('only')?.split(',')
  const scenarios = SETS[flag('set') ?? 'light']!
  fs.mkdirSync(out, { recursive: true })
  const server = await startServer(PORT)
  const browser = await launch({
    headless: true,
    args: [
      ...BASE_CHROME_ARGS,
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  })
  const summary: Record<string, Record<string, number>[]> = {}
  for (let run = 0; run < runs; run++) {
    for (const arm of list('arms', 'base')) {
      for (const [name, s] of Object.entries(scenarios)) {
        if (only && !only.includes(name)) {
          continue
        }
        const ctx = await browser.createBrowserContext()
        const page = await ctx.newPage()
        await page.setViewport({ width: 1500, height: 900 })
        await page.evaluateOnNewDocument(installMarkers)
        if (arm === 'nothrottle') {
          await page.evaluateOnNewDocument(collapseSuspenseThrottle)
        }
        if (arm === 'suspense') {
          await page.evaluateOnNewDocument(logSuspenseBoundaries)
        }
        const url = `http://localhost:${PORT}/?config=${s.config}&renderer=${renderer}&sessionName=P&session=${encodeSessionSpec(s.spec)}`
        for (const phase of list('phases', 'cold,warm')) {
          await page.tracing.start({
            path: path.join(
              out,
              `${name}-${renderer}-${arm}-${phase}-${run}.json`,
            ),
            categories: [
              'devtools.timeline',
              'disabled-by-default-devtools.timeline',
              'v8.execute',
              'v8',
              'disabled-by-default-v8.cpu_profiler',
              'blink.user_timing',
              'loading',
              'toplevel',
            ],
          })
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 180000,
          })
          await page.waitForSelector(s.wait, { timeout: 180000 })
          await new Promise(r => setTimeout(r, 400))
          await page.tracing.stop()
          const ms = await page.evaluate(() => ({
            ...(window as any).__ms,
            throttled: (window as any).__throttled,
            suspense: (window as any).__suspense,
          }))
          ;(summary[`${name}-${arm}-${phase}`] ??= []).push(ms)
          console.log(name, arm, phase, run, JSON.stringify(ms))
        }
        await ctx.close()
      }
    }
  }
  fs.writeFileSync(
    path.join(out, `summary-${renderer}.json`),
    JSON.stringify(summary, null, 1),
  )
  for (const [k, v] of Object.entries(summary)) {
    const cells = MILESTONES.map(m => {
      const vals = v.map(x => x[m]).filter(x => x !== undefined)
      return `${m} ${vals.length ? median(vals)!.toFixed(0) : '-'}`
    })
    console.log(k.padEnd(28), cells.join('  '))
  }
  await browser.close()
  server.close()
}

interface Profile {
  tid?: number
  last: number
  nodes: Map<number, { id: number; parent?: number; callFrame: Frame }>
  samples: { t: number; id: number }[]
}

function readTrace(file: string) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const events: any[] = Array.isArray(raw) ? raw : raw.traceEvents
  const marks = events.filter(
    e => e.cat?.includes('blink.user_timing') && e.name?.startsWith('jb:'),
  )
  if (!marks.length) {
    throw new Error(`${file}: no jb: marks`)
  }
  const pid = marks[0].pid
  const mainTid = marks[0].tid
  const t0 = marks[0].ts - marks[0].args.data.startTime * 1000
  const rel = (ts: number) => (ts - t0) / 1000
  const threadName = new Map<number, string>()
  for (const e of events) {
    if (e.name === 'thread_name' && e.pid === pid) {
      threadName.set(e.tid, e.args.name)
    }
  }
  const profiles = new Map<string, Profile>()
  for (const e of events) {
    if (e.pid !== pid || (e.name !== 'Profile' && e.name !== 'ProfileChunk')) {
      continue
    }
    const key = String(e.id)
    let p = profiles.get(key)
    if (!p) {
      p = { last: 0, nodes: new Map(), samples: [] }
      profiles.set(key, p)
    }
    if (e.name === 'Profile') {
      p.tid = e.tid
      p.last = e.args.data.startTime
      continue
    }
    for (const n of e.args.data.cpuProfile?.nodes ?? []) {
      p.nodes.set(n.id, n)
    }
    const samples = e.args.data.cpuProfile?.samples ?? []
    const deltas = e.args.data.timeDeltas ?? []
    for (let i = 0; i < samples.length; i++) {
      p.last += deltas[i] ?? 0
      p.samples.push({ t: p.last, id: samples[i] })
    }
  }
  const ms: Record<string, number> = {}
  for (const m of marks) {
    ms[m.name.slice(3)] ??= rel(m.ts)
  }
  return { events, pid, mainTid, rel, threadName, profiles, ms }
}

function bucketOf(label: string) {
  const m = /\[(.*):\d+\]$/.exec(label)
  if (!m) {
    return label.startsWith('(') ? label.split(' ')[0]! : 'native/builtin'
  }
  const src = m[1]!
  if (src.startsWith('~/')) {
    const p = src.slice(2).split('/')
    return `npm:${p[0]!.startsWith('@') ? `${p[0]}/${p[1]}` : p[0]}`
  }
  const ws = /(?:^|\/)(packages|plugins|products)\/([^/]+)\//.exec(src)
  return ws ? `${ws[1]}/${ws[2]}` : `other:${src.slice(0, 40)}`
}

function makeLabeller() {
  const resolver = createFrameResolver()
  const cache = new Map<string, string>()
  return {
    async label(cf: Frame) {
      const k = `${cf.url}:${cf.lineNumber}:${cf.columnNumber}:${cf.functionName}`
      let l = cache.get(k)
      if (!l) {
        l = cf.url ? await resolver.resolve(cf) : cf.functionName || '(anon)'
        cache.set(k, l)
      }
      return l
    },
    counts: () => resolver.counts(),
  }
}

async function analyze(files: string[]) {
  const { label, counts } = makeLabeller()
  for (const file of files) {
    const { events, pid, mainTid, rel, threadName, profiles, ms } =
      readTrace(file)
    const end = ms.drawn ?? ms.appReady ?? Math.max(...Object.values(ms))
    console.log(`\n######## ${path.basename(file)}   end=${end.toFixed(0)}ms`)
    console.log(
      'milestones:',
      Object.entries(ms)
        .sort((a, b) => a[1] - b[1])
        .map(([k, v]) => `${k}@${v.toFixed(0)}`)
        .join('  '),
    )

    const requests = new Map<
      string,
      { url: string; start: number; tid: number; end?: number }
    >()
    for (const e of events) {
      const d = e.args?.data
      if (e.name === 'ResourceSendRequest' && d?.url) {
        requests.set(d.requestId, { url: d.url, start: rel(e.ts), tid: e.tid })
      } else if (e.name === 'ResourceFinish' && requests.has(d?.requestId)) {
        requests.get(d.requestId)!.end = rel(e.ts)
      }
    }
    console.log('requests (start→end thread url):')
    for (const r of [...requests.values()]
      .filter(r => r.start <= end)
      .sort((a, b) => a.start - b.start)) {
      const thread = (threadName.get(r.tid) ?? '?').slice(0, 16).padEnd(16)
      const url = r.url.replace(/^.*localhost:\d+\//, '').replace(/\?.*$/, '')
      console.log(
        `  ${r.start.toFixed(0).padStart(6)}→${(r.end ?? Number.NaN).toFixed(0).padStart(6)} ${thread} ${url.slice(0, 70)}`,
      )
    }

    const fires = new Map<number, number>()
    for (const e of events) {
      if (e.name === 'TimerFire' && e.pid === pid && e.tid === mainTid) {
        fires.set(e.args.data.timerId, rel(e.ts))
      }
    }
    const timers = events
      .filter(
        e =>
          e.name === 'TimerInstall' &&
          e.pid === pid &&
          e.tid === mainTid &&
          e.args.data.timeout >= 20 &&
          e.args.data.timeout <= 300,
      )
      .map(e => {
        const fired = fires.get(e.args.data.timerId)
        return `@${rel(e.ts).toFixed(0)}+${e.args.data.timeout}${fired === undefined ? ' cleared' : ` fired@${fired.toFixed(0)}`}`
      })
    console.log(`main-thread 20-300ms timers: ${timers.join(' ')}`)

    for (const p of profiles.values()) {
      const byBucket = new Map<string, number>()
      const byFn = new Map<string, number>()
      let busy = 0
      for (let i = 1; i < p.samples.length; i++) {
        const s = p.samples[i]!
        const n = p.nodes.get(s.id)
        if (
          rel(s.t) < 0 ||
          rel(s.t) > end ||
          !n ||
          n.callFrame.functionName === '(idle)'
        ) {
          continue
        }
        const dt = (s.t - p.samples[i - 1]!.t) / 1000
        busy += dt
        const l = await label(n.callFrame)
        byBucket.set(bucketOf(l), (byBucket.get(bucketOf(l)) ?? 0) + dt)
        byFn.set(l, (byFn.get(l) ?? 0) + dt)
      }
      if (busy < 20) {
        continue
      }
      console.log(
        `  -- ${threadName.get(p.tid!) ?? p.tid} (${p.tid}): busy ${busy.toFixed(0)}ms before end`,
      )
      const top = [...byBucket].sort((a, b) => b[1] - a[1]).slice(0, 14)
      console.log(
        `     ${top.map(([b, v]) => `${b} ${v.toFixed(0)}`).join(' | ')}`,
      )
      for (const [f, v] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`       ${v.toFixed(1).padStart(7)}  ${f.slice(0, 150)}`)
      }
    }
  }
  console.log(JSON.stringify(counts()))
}

async function inclusive(
  file: string,
  from: number,
  to: number,
  which: string,
  topN: number,
) {
  const { label } = makeLabeller()
  const { rel, mainTid, threadName, profiles } = readTrace(file)
  const candidates = [...profiles.values()].filter(p =>
    which === 'main'
      ? p.tid === mainTid
      : (threadName.get(p.tid!) ?? '').includes('DedicatedWorker'),
  )
  const p = candidates.sort((a, b) => b.samples.length - a.samples.length)[0]!
  const incl = new Map<string, number>()
  let total = 0
  for (let i = 1; i < p.samples.length; i++) {
    const s = p.samples[i]!
    const leaf = p.nodes.get(s.id)
    if (
      rel(s.t) < from ||
      rel(s.t) > to ||
      !leaf ||
      leaf.callFrame.functionName === '(idle)'
    ) {
      continue
    }
    const dt = (s.t - p.samples[i - 1]!.t) / 1000
    total += dt
    const seen = new Set<string>()
    for (
      let n: typeof leaf | undefined = leaf;
      n;
      n = n.parent === undefined ? undefined : p.nodes.get(n.parent)
    ) {
      const l = (await label(n.callFrame)).replace(/:\d+\]$/, ']')
      if (!seen.has(l)) {
        seen.add(l)
        incl.set(l, (incl.get(l) ?? 0) + dt)
      }
    }
  }
  console.log(
    `${threadName.get(p.tid!)} busy ${total.toFixed(0)}ms in [${from},${to}]`,
  )
  for (const [l, v] of [...incl]
    .filter(([l]) => /packages\/|plugins\/|@gmod/.test(l))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)) {
    console.log(
      `${v.toFixed(0).padStart(7)} ${((100 * v) / total).toFixed(0).padStart(3)}%  ${l.slice(0, 150)}`,
    )
  }
}

const [mode, ...rest] = process.argv.slice(2)
const files = rest.filter(a => !a.startsWith('--'))
const job =
  mode === 'capture'
    ? capture()
    : mode === 'analyze'
      ? analyze(files)
      : inclusive(
          files[0]!,
          Number(files[1]),
          Number(files[2]),
          files[3] ?? 'worker',
          Number(files[4] ?? 45),
        )
void job.then(() => process.exit(0))
