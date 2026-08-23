/* eslint-disable no-console */
// Scroll-zoom frame profiler. Opens a JBrowse Web URL, records a DevTools
// trace (timeline + v8 sampler + React's performance tracks) across a burst of
// wheel-zoom events over the tracks, and prints the per-frame numbers that
// decide whether a change helped: rAF durations, forced style/layout with the
// JS frame that forced them, per-component React render counts, and top
// self-time functions. Not part of the suite.
//
//     node browser-tests/profile-zoom.ts
//     URL='http://localhost:3000/?config=...&session=...' node browser-tests/profile-zoom.ts
//     HEADLESS=0 WHEELS=200 DELTA=40 OUT=/tmp/zoom node browser-tests/profile-zoom.ts
//
// Headless Chrome has no WebGPU, so displays fall back to WebGL there; the
// React/DOM side of a frame, which is what this measures, is the same. Run
// HEADLESS=0 against a system Chrome for the WebGPU path.
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import puppeteer from 'puppeteer'

import { waitForJBrowseReady } from '../../jbrowse-capture/src/index.ts'

import type { Page } from 'puppeteer'

const URL =
  process.env.URL ||
  'http://localhost:3000/?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fce%2Fconfig.json&session=share-PxfOV2_%2Fbw&password=PWdht'
// Headed by default: headless Chrome has no WebGPU, so the displays would fall
// back to WebGL and the frame would not be the one a user gets.
const HEADLESS = process.env.HEADLESS === '1'
const SYSTEM_CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CHROME =
  process.env.CHROME ||
  (fs.existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : undefined)
// Where the served bundle's .map files live, for resolving minified prod frames
const BUILD = process.env.BUILD || 'build'
const OUT = process.env.OUT || path.join(tmpdir(), 'jbrowse-zoom-profile')
const WHEELS = Number(process.env.WHEELS || 500)
// The octaves the gesture sweeps between. A one-way zoom bottoms out and every
// wheel after that is a no-op the profile still counts, so the gesture turns
// around at each bound.
const MIN_BP = Number(process.env.MIN_BP || 0.5)
const MAX_BP = Number(process.env.MAX_BP || 4)
const DELTA = Number(process.env.DELTA || 30)
// One wheel due every this many ms of wall clock, whatever the page manages to
// keep up with
const GAP_MS = Number(process.env.GAP_MS || 12)
const READY_MS = Number(process.env.READY_MS || 20000)
const LABEL =
  process.env.LABEL || new Date().toISOString().replaceAll(/[:.]/g, '-')

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

interface TraceEvent {
  name: string
  cat?: string
  ph?: string
  ts: number
  dur?: number
  pid: number
  tid: number
  id?: string
  args?: Record<string, any>
}

function pct(sorted: number[], p: number) {
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!
    : 0
}

function ms(us: number) {
  return (us / 1000).toFixed(1)
}

// A trace event's stackTrace lines/columns are 1-based, unlike a CPU profile's.
function stackKey(e: TraceEvent) {
  const st = e.args?.beginData?.stackTrace as
    | {
        functionName?: string
        lineNumber?: number
        columnNumber?: number
        url?: string
      }[]
    | undefined
  return st?.length
    ? st
        .slice(0, 2)
        .map(f =>
          frameLabel(
            `${f.functionName || '?'}\u0000${f.url ?? ''}\u0000${(f.lineNumber ?? 1) - 1}\u0000${(f.columnNumber ?? 1) - 1}`,
          ),
        )
        .join(' <- ')
    : '(no stack)'
}

// Minified prod frames resolved through the build's .map files. Only the
// handful of frames that make the printed list get looked up, so the whole
// mappings string is decoded once per chunk and searched, rather than indexed.
const B64 = new Map(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .map((c, i) => [c, i] as const),
)

function decodeVlq(segment: string) {
  const out: number[] = []
  let value = 0
  let shift = 0
  for (const ch of segment) {
    const digit = B64.get(ch)
    if (digit === undefined) {
      return out
    }
    value += (digit & 31) << shift
    if (digit & 32) {
      shift += 5
    } else {
      const negative = value & 1
      value >>= 1
      out.push(negative ? (value === 0 ? -0x80000000 : -value) : value)
      value = 0
      shift = 0
    }
  }
  return out
}

interface SourceMap {
  sources: string[]
  // per generated line, sorted [generatedColumn, sourceIndex, originalLine]
  lines: [number, number, number][][]
}

function parseSourceMap(json: string): SourceMap {
  const raw = JSON.parse(json)
  const lines: [number, number, number][][] = []
  let sourceIndex = 0
  let originalLine = 0
  for (const lineText of String(raw.mappings).split(';')) {
    const segments: [number, number, number][] = []
    let generatedColumn = 0
    for (const segment of lineText.split(',')) {
      const fields = decodeVlq(segment)
      if (fields.length === 0) {
        continue
      }
      generatedColumn += fields[0]!
      if (fields.length >= 4) {
        sourceIndex += fields[1]!
        originalLine += fields[2]!
        segments.push([generatedColumn, sourceIndex, originalLine])
      }
    }
    lines.push(segments)
  }
  return { sources: raw.sources, lines }
}

const sourceMaps = new Map<string, SourceMap | null>()

function loadSourceMap(url: string) {
  if (!sourceMaps.has(url)) {
    const file = `${path.join(BUILD, new globalThis.URL(url).pathname)}.map`
    sourceMaps.set(
      url,
      fs.existsSync(file)
        ? parseSourceMap(fs.readFileSync(file, 'utf8'))
        : null,
    )
  }
  return sourceMaps.get(url)!
}

function originalLocation(url: string, line: number, column: number) {
  const map = url.startsWith('http') ? loadSourceMap(url) : null
  const segments = map?.lines[line]
  if (!segments?.length) {
    return undefined
  }
  let lo = 0
  let hi = segments.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (segments[mid]![0] <= column) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  const [, sourceIndex, originalLine] = segments[lo]!
  return `${shortUrl(map!.sources[sourceIndex] || '?')}:${originalLine + 1}`
}

function frameLabel(key: string) {
  const [fn, url, line, column] = key.split('\u0000')
  if (!url) {
    return fn!
  }
  const original = originalLocation(url, Number(line), Number(column))
  return `${fn} ${original ?? `${shortUrl(url)}:${Number(line) + 1}`}`
}

function shortUrl(url: string) {
  return url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^webpack:\/\/@jbrowse\/web\/\.\.\/\.\.\//, '')
    .replace(/^webpack:\/\/\/\.\.\/\.\.\//, '')
    .replace(/node_modules\/\.pnpm\/[^/]+\/node_modules\//, '')
    .replace(/\?$/, '')
}

export function summarize(events: TraceEvent[]) {
  const threadName = new Map<string, string>()
  for (const e of events) {
    if (e.cat === '__metadata' && e.name === 'thread_name') {
      threadName.set(`${e.pid}:${e.tid}`, e.args?.name)
    }
  }
  const perThread = new Map<string, number>()
  for (const e of events) {
    const k = `${e.pid}:${e.tid}`
    if (threadName.get(k) === 'CrRendererMain') {
      perThread.set(k, (perThread.get(k) || 0) + 1)
    }
  }
  const mainKey = [...perThread.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const onMain = (e: TraceEvent) => `${e.pid}:${e.tid}` === mainKey
  const main = events.filter(e => onMain(e) && e.ph === 'X')

  const wheels = events.filter(
    e => e.name === 'EventDispatch' && e.args?.data?.type === 'wheel',
  )
  const w0 = wheels[0]?.ts ?? Math.min(...main.map(e => e.ts))
  const w1 = wheels.length
    ? wheels.at(-1)!.ts + 1_000_000
    : Math.max(...main.map(e => e.ts))
  const inWindow = (e: TraceEvent) => e.ts >= w0 && e.ts <= w1

  const raf = main
    .filter(e => e.name === 'FireAnimationFrame' && inWindow(e))
    .map(e => e.dur || 0)
    .sort((a, b) => a - b)
  const tasks = main.filter(e => e.name === 'RunTask' && inWindow(e))
  const busy = tasks.reduce((a, e) => a + (e.dur || 0), 0)
  const long = tasks.filter(e => (e.dur || 0) > 50_000).length

  const forced = (name: string) => {
    const byStack = new Map<string, { n: number; us: number }>()
    let total = 0
    for (const e of main) {
      if (e.name !== name || !inWindow(e)) {
        continue
      }
      total += e.dur || 0
      const k = stackKey(e)
      const cur = byStack.get(k) || { n: 0, us: 0 }
      cur.n += 1
      cur.us += e.dur || 0
      byStack.set(k, cur)
    }
    return {
      total,
      top: [...byStack.entries()].sort((a, b) => b[1].us - a[1].us).slice(0, 6),
    }
  }

  const renders = new Map<string, number>()
  for (const e of events) {
    if (e.cat === 'blink.user_timing' && e.ph === 'b' && inWindow(e)) {
      const n = e.name.replaceAll('​', '')
      renders.set(n, (renders.get(n) || 0) + 1)
    }
  }

  // v8 sampler for the main thread. The Profile event carries the thread; the
  // ProfileChunks that follow are emitted from v8's own profiler threads and are
  // tied back to it only by `id`, so matching on tid finds nothing.
  const mainProfileId = events.find(e => e.name === 'Profile' && onMain(e))?.id
  const nodes = new Map<
    number,
    { callFrame: Record<string, any>; parent?: number }
  >()
  const samples: number[] = []
  const deltas: number[] = []
  let profStart = 0
  for (const e of events) {
    if (e.id !== mainProfileId) {
      continue
    }
    if (e.name === 'Profile') {
      profStart = e.args?.data?.startTime || 0
    }
    if (e.name === 'ProfileChunk') {
      const cp = e.args?.data?.cpuProfile
      for (const n of cp?.nodes || []) {
        nodes.set(n.id, n)
      }
      samples.push(...(cp?.samples || []))
      deltas.push(...(e.args?.data?.timeDeltas || []))
    }
  }
  let t = profStart
  const pairs: [number, number][] = []
  for (let i = 0; i < samples.length; i++) {
    t += deltas[i] || 0
    pairs.push([t, samples[i]!])
  }
  pairs.sort((a, b) => a[0] - b[0])
  const self = new Map<string, number>()
  let sampled = 0
  for (let i = 0; i < pairs.length; i++) {
    const [ts, id] = pairs[i]!
    if (ts < w0 || ts > w1) {
      continue
    }
    const next = pairs[i + 1]?.[0] ?? ts
    const d = Math.min(Math.max(next - ts, 0), 2000)
    const cf = nodes.get(id)?.callFrame
    if (!cf) {
      continue
    }
    const fn = cf.functionName || '(anon)'
    const key = cf.url
      ? `${fn}\u0000${cf.url}\u0000${cf.lineNumber ?? 0}\u0000${cf.columnNumber ?? 0}`
      : fn
    self.set(key, (self.get(key) || 0) + d)
    sampled += d
  }
  const topSelf = [...self.entries()]
    .filter(([k]) => !/^\((idle|program|root)\)/.test(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 22)

  const dropped = events.filter(
    e => e.name === 'DroppedFrame' && inWindow(e),
  ).length

  // Worker → main traffic. Each message is its own task, so the interesting
  // number is not the count but the task time those messages carry: a status
  // side-channel that fires per progress event costs a task apiece even when
  // the main thread throttles what it does with them.
  const sortedTasks = [...tasks].sort((a, b) => a.ts - b.ts)
  const taskStarts = sortedTasks.map(e => e.ts)
  const messages = main.filter(
    e => e.name === 'HandlePostMessage' && inWindow(e),
  )
  let messageTaskUs = 0
  for (const m of messages) {
    let lo = 0
    let hi = taskStarts.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (taskStarts[mid]! <= m.ts) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    const task = sortedTasks[lo]
    if (task && task.ts + (task.dur || 0) >= m.ts) {
      messageTaskUs += task.dur || 0
    }
  }

  const timers = new Map<string, number>()
  for (const e of main) {
    if (e.name !== 'TimerInstall' || !inWindow(e)) {
      continue
    }
    const st = e.args?.data?.stackTrace as
      | {
          functionName?: string
          lineNumber?: number
          columnNumber?: number
          url?: string
        }[]
      | undefined
    const f = st?.[0]
    const k = f
      ? frameLabel(
          `${f.functionName || '?'}\u0000${f.url ?? ''}\u0000${(f.lineNumber ?? 1) - 1}\u0000${(f.columnNumber ?? 1) - 1}`,
        )
      : '(no stack)'
    timers.set(k, (timers.get(k) || 0) + 1)
  }

  return {
    window: { ms: (w1 - w0) / 1000, wheels: wheels.length },
    raf: {
      n: raf.length,
      p50: pct(raf, 0.5),
      p90: pct(raf, 0.9),
      max: raf.at(-1) || 0,
      sum: raf.reduce((a, b) => a + b, 0),
    },
    main: { busy, tasks: tasks.length, long, dropped },
    workerMessages: { n: messages.length, taskUs: messageTaskUs },
    timers: [...timers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    styleRecalc: forced('UpdateLayoutTree'),
    layout: forced('Layout'),
    renders: [...renders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18),
    topSelf,
    sampled,
  }
}

export function print(s: ReturnType<typeof summarize>) {
  console.log(
    `window ${s.window.ms.toFixed(0)}ms, ${s.window.wheels} wheel dispatches, main busy ${ms(s.main.busy)}ms in ${s.main.tasks} tasks (${s.main.long} >50ms), ${s.main.dropped} dropped frames`,
  )
  console.log(
    `worker messages: ${s.workerMessages.n} handled, ${ms(s.workerMessages.taskUs)}ms of task time`,
  )
  console.log(
    `timers installed: ${s.timers.map(([k, n]) => `${n}x ${k}`).join('  ') || 'none'}`,
  )
  console.log(
    `rAF callbacks: n=${s.raf.n} p50=${ms(s.raf.p50)} p90=${ms(s.raf.p90)} max=${ms(s.raf.max)} sum=${ms(s.raf.sum)}ms`,
  )
  for (const [label, f] of [
    ['style recalc', s.styleRecalc],
    ['layout', s.layout],
  ] as const) {
    console.log(`${label}: ${ms(f.total)}ms total`)
    for (const [k, v] of f.top) {
      console.log(
        `    ${String(v.n).padStart(4)}x ${ms(v.us).padStart(7)}ms  ${k}`,
      )
    }
  }
  console.log('component renders:')
  console.log(`    ${s.renders.map(([n, c]) => `${n}=${c}`).join('  ')}`)
  console.log(`top self time (sampled ${ms(s.sampled)}ms):`)
  for (const [k, v] of s.topSelf) {
    console.log(`    ${ms(v).padStart(7)}ms  ${frameLabel(k)}`)
  }
}

// What the app says is still working when the ready gate times out — the
// per-display attributes are silent about a view that has not initialized.
function pendingWork(page: Page) {
  return page.evaluate(() => {
    interface C {
      tracks?: { displays?: { type?: string; displayPhase?: string }[] }[]
    }
    interface V extends C {
      type?: string
      showLoading?: boolean
      initialized?: boolean
      trackContainers?: C[]
      views?: V[]
    }
    const w = window as unknown as { JBrowseSession?: { views?: V[] } }
    const loadingIn = (c: C) =>
      (c.tracks ?? []).flatMap(t =>
        (t.displays ?? [])
          .filter(d => d.displayPhase === 'loading')
          .map(d => `${d.type}: loading`),
      )
    const walk = (v: V): string[] => [
      ...(v.showLoading === true ? [`${v.type}: showLoading`] : []),
      ...(v.initialized === false ? [`${v.type}: uninitialized`] : []),
      ...loadingIn(v),
      ...(v.trackContainers ?? []).flatMap(loadingIn),
      ...(v.views ?? []).flatMap(walk),
    ]
    return (w.JBrowseSession?.views ?? []).flatMap(walk)
  })
}

/**
 * Drive the zoom from inside the page, on a wall-clock schedule.
 *
 * `page.mouse.wheel` looked more faithful and made the benchmark unusable: each
 * call is a CDP round trip that the page's own busyness delays, so a slower
 * build ran a SHORTER gesture and its trace showed less work. Here the events
 * are due at fixed times and a tick that arrives late dispatches everything it
 * missed, so every run applies the same total zoom over the same window
 * whatever the frame rate — which is the only way the two are comparable.
 *
 * The events are synthetic, and `createWheelZoomController` binds a plain
 * listener to this element, so they arrive exactly as a trackpad's do; what they
 * skip is the compositor's scroll latching, which a zoom preventDefaults anyway.
 * The page also samples its own rAF timestamps, so the frame rate is measured by
 * the thing being measured rather than inferred from the trace.
 */
function driveGesture(page: Page, box: { x: number; y: number }) {
  return page.evaluate(
    async ({ box, wheels, gapMs, delta, minBp, maxBp }) => {
      const el = document.querySelector('[data-testid="tracksContainer"]')!
      const view = (
        window as unknown as {
          JBrowseSession?: { views?: { bpPerPx?: number }[] }
        }
      ).JBrowseSession?.views?.[0]
      const frames: number[] = []
      let sampling = true
      const sample = (t: number) => {
        if (sampling) {
          frames.push(t)
          requestAnimationFrame(sample)
        }
      }
      requestAnimationFrame(sample)
      const zooms: number[] = []
      const start = performance.now()
      let dispatched = 0
      // Direction turns on the zoom itself, not on a wheel count: the rate
      // limiter is per elapsed-ms, so a run that renders fewer frames applies
      // its zoom in bigger steps and a fixed count leaves each run at a
      // different place on the scale. Runs then render different amounts of
      // MAF/wiggle detail, which is a larger difference than anything being
      // measured. Bounded, every run sweeps the same octaves.
      let inward = true
      while (dispatched < wheels) {
        const due = Math.min(
          wheels,
          Math.ceil((performance.now() - start) / gapMs) + 1,
        )
        while (dispatched < due) {
          const bp = view?.bpPerPx ?? 1
          if (inward ? bp <= minBp : bp >= maxBp) {
            inward = !inward
          }
          el.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: inward ? -delta : delta,
              clientX: box.x,
              clientY: box.y,
              bubbles: true,
              cancelable: true,
              composed: true,
            }),
          )
          dispatched++
          if (dispatched % 20 === 0) {
            zooms.push(view?.bpPerPx ?? Number.NaN)
          }
        }
        await new Promise(r => {
          setTimeout(r, gapMs)
        })
      }
      const elapsed = performance.now() - start
      sampling = false
      zooms.push(view?.bpPerPx ?? Number.NaN)
      return { elapsed, dispatched, frames, zooms }
    },
    {
      box,
      wheels: WHEELS,
      gapMs: GAP_MS,
      delta: DELTA,
      minBp: MIN_BP,
      maxBp: MAX_BP,
    },
  )
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const tracePath = path.join(OUT, `zoom-${LABEL}.json`)
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-web-security', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
  })
  const page = await browser.newPage()
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  try {
    // Short: this session's LinearSyntenyDisplay never leaves `loading`, so the
    // gate cannot pass and a long timeout is two dead minutes per run. The
    // displays that matter are drawn well inside this.
    await waitForJBrowseReady(page, { timeout: READY_MS, settleMs: 1500 })
  } catch (e) {
    console.log(`ready gate did not pass, profiling anyway: ${e}`)
    console.log(
      `still pending: ${(await pendingWork(page)).join(', ') || 'nothing'}`,
    )
  }
  await page.evaluate(() => {
    const w = window as unknown as {
      JBrowseSession?: { setScrollZoom?: (f: boolean) => void }
    }
    w.JBrowseSession?.setScrollZoom?.(true)
  })

  const box = await page.$eval('[data-testid="tracksContainer"]', el => {
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 300) }
  })
  await page.mouse.move(box.x, box.y)
  await delay(300)

  await page.tracing.start({
    path: tracePath,
    screenshots: false,
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-v8.cpu_profiler',
      'blink.user_timing',
      'v8.execute',
      'toplevel',
    ],
  })
  await delay(200)
  const gesture = await driveGesture(page, box)
  await delay(1500)
  await page.tracing.stop()
  await browser.close()
  const intervals = gesture.frames
    .slice(1)
    .map((t, i) => t - gesture.frames[i]!)
    .sort((a, b) => a - b)
  console.log(
    `gesture ${gesture.elapsed.toFixed(0)}ms, ${gesture.dispatched} wheels dispatched, bpPerPx ${gesture.zooms.map(z => z.toPrecision(3)).join(' ')}`,
  )
  console.log(
    `page frames: ${gesture.frames.length} in ${(gesture.elapsed / 1000).toFixed(1)}s = ${(gesture.frames.length / (gesture.elapsed / 1000)).toFixed(1)} fps, interval p50=${pct(intervals, 0.5).toFixed(1)}ms p90=${pct(intervals, 0.9).toFixed(1)}ms`,
  )

  const raw = JSON.parse(fs.readFileSync(tracePath, 'utf8'))
  const events: TraceEvent[] = Array.isArray(raw) ? raw : raw.traceEvents
  const s = summarize(events)
  console.log(`trace ${tracePath}`)
  print(s)
  fs.writeFileSync(
    path.join(OUT, `zoom-${LABEL}.summary.json`),
    JSON.stringify(s, null, 2),
  )
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  main().catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
}
