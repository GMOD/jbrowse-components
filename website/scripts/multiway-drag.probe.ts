/* eslint-disable no-console */
// Where does a frame go while the multi-way synteny track is dragged?
//
//   node website/scripts/multiway-drag.probe.ts
//
// Serves products/jbrowse-web/build, opens the tutorial's own session, drags
// the view, and reports: rAF gaps during the drag, the MobX-chain vs React
// split per horizontalScroll, and a sampled CPU profile mapped back through
// the build's source maps. A control arm drops the multiway track.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  sessionSpecQuery,
  waitForJBrowseReady,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

import type { AddressInfo } from 'node:net'
import type { Page } from 'puppeteer'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const buildPath = path.join(repoRoot, 'products', 'jbrowse-web', 'build')
const traceMappingDir = path.join(
  repoRoot,
  'node_modules/.pnpm/@jridgewell+trace-mapping@0.3.31/node_modules/@jridgewell/trace-mapping',
)
interface TraceMapLib {
  TraceMap: new (map: string) => object
  originalPositionFor: (
    map: object,
    pos: { line: number; column: number },
  ) => { source: string | null; name: string | null }
}
const { TraceMap, originalPositionFor } = (await import(
  path.join(traceMappingDir, 'dist/trace-mapping.mjs')
)) as TraceMapLib

const CONFIG = 'https://jbrowse.org/demos/grape_peach_cacao/config.json'
const VIEWPORT = { width: 1600, height: 900 }
const DRAG_STEPS = 50
const DRAG_STEP_PX = 12
const DRAG_STEP_MS = 16
const SCROLL_SAMPLES = 40

const multiwayTrack = {
  trackId: 'grape_peach_cacao_blocks',
  type: 'MultiWaySyntenyDisplay',
  rowOrder: ['peach', 'cacao', 'poplar', 'citrus', 'arabidopsis', 'tomato'],
  height: 340,
}
const geneTrack = {
  trackId: 'grape_genes',
  type: 'LinearBasicDisplay',
  showOnlyGenes: true,
  displayMode: 'compact',
}
function session(withMultiway: boolean) {
  return {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'grape',
        loc: '11:778,000-866,000',
        tracks: withMultiway ? [geneTrack, multiwayTrack] : [geneTrack],
      },
    ],
  }
}

const server = http.createServer((req, res) => {
  void handler(req, res, { public: buildPath })
})
await new Promise<void>(r => {
  server.listen(0, '127.0.0.1', () => {
    r()
  })
})
const port = (server.address() as AddressInfo).port
const origin = `http://127.0.0.1:${port}`

const mapCache = new Map<string, object | null>()
function traceMapFor(url: string) {
  let map = mapCache.get(url)
  if (map === undefined) {
    map = null
    if (url.startsWith(origin)) {
      const file = `${path.join(buildPath, new URL(url).pathname)}.map`
      if (fs.existsSync(file)) {
        map = new TraceMap(fs.readFileSync(file, 'utf8'))
      }
    }
    mapCache.set(url, map)
  }
  return map
}

function shortSource(source: string | null) {
  if (!source) {
    return '?'
  }
  const s = source.replace(/^(\.\.\/)+/, '').replace(/^webpack:\/\/\/?/, '')
  const nm = s.lastIndexOf('node_modules/')
  if (nm !== -1) {
    const rest = s.slice(nm + 'node_modules/'.length)
    const parts = rest.split('/')
    const pkg = parts[0]!.startsWith('@')
      ? `${parts[0]}/${parts[1]}`
      : parts[0]!
    return `node_modules/${pkg}`
  }
  return s
}

interface ProfileNode {
  id: number
  callFrame: {
    functionName: string
    url: string
    lineNumber: number
    columnNumber: number
  }
  children?: number[]
}
interface Profile {
  nodes: ProfileNode[]
  samples: number[]
  timeDeltas: number[]
}

function attribute(profile: Profile) {
  const bySource = new Map<string, number>()
  const byFunction = new Map<string, number>()
  const nodeById = new Map(profile.nodes.map(n => [n.id, n]))
  let total = 0
  const selfByNode = new Map<number, number>()
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = profile.timeDeltas[i]! / 1000
    total += dt
    selfByNode.set(
      profile.samples[i]!,
      (selfByNode.get(profile.samples[i]!) ?? 0) + dt,
    )
  }
  for (const [id, ms] of selfByNode) {
    const { callFrame } = nodeById.get(id)!
    let source = callFrame.url
      ? shortSource(callFrame.url)
      : `(${callFrame.functionName || 'program'})`
    let name = callFrame.functionName || '(anonymous)'
    const map = traceMapFor(callFrame.url)
    if (map) {
      const pos = originalPositionFor(map, {
        line: callFrame.lineNumber + 1,
        column: callFrame.columnNumber,
      })
      if (pos.source) {
        source = shortSource(pos.source)
        name = pos.name ?? name
      }
    }
    bySource.set(source, (bySource.get(source) ?? 0) + ms)
    const key = `${name}  [${source}]`
    byFunction.set(key, (byFunction.get(key) ?? 0) + ms)
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m].sort((a, b) => b[1] - a[1]).slice(0, n)
  return { total, bySource: top(bySource, 18), byFunction: top(byFunction, 22) }
}

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p: number) =>
    s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0
  return {
    n: s.length,
    median: q(0.5),
    p90: q(0.9),
    max: s.at(-1) ?? 0,
    mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length),
  }
}

async function runArm(page: Page, label: string, withMultiway: boolean) {
  const url = `${origin}/${sessionSpecQuery({
    config: CONFIG,
    session: session(withMultiway),
  })}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await waitForJBrowseReady(page, {
    assembly: 'grape',
    trackIds: withMultiway
      ? ['grape_genes', 'grape_peach_cacao_blocks']
      : ['grape_genes'],
    timeout: 120000,
    settleMs: 1500,
  })

  const shape = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="multiway-synteny-display"]',
    )
    const svg = el?.querySelector('svg')
    const count = (sel: string) => svg?.querySelectorAll(sel).length ?? 0
    const view = (window as any).JBrowseSession.views[0]
    return {
      viewWidth: view.width as number,
      svgNodes: svg ? svg.querySelectorAll('*').length : 0,
      paths: count('path'),
      rects: count('rect'),
      lines: count('line'),
      texts: count('text'),
      titles: count('title'),
      allDom: document.querySelectorAll('*').length,
    }
  })

  // per-step split: MobX chain (synchronous inside the action) vs the React
  // sync-lane flush that lands in the microtask right after it
  const split = await page.evaluate(async (n: number) => {
    const view = (window as any).JBrowseSession.views[0]
    const mobx: number[] = []
    const react: number[] = []
    let dir = 1
    for (let i = 0; i < n; i++) {
      if (i % 10 === 9) {
        dir = -dir
      }
      const t0 = performance.now()
      view.horizontalScroll(7 * dir)
      const t1 = performance.now()
      await Promise.resolve()
      await Promise.resolve()
      const t2 = performance.now()
      mobx.push(t1 - t0)
      react.push(t2 - t1)
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))
    }
    return { mobx, react }
  }, SCROLL_SAMPLES)

  // a real drag, rAF-timed in-page, under the sampling profiler
  const box = await (await page.$(
    '[data-testid="tracksContainer"]',
  ))!.boundingBox()
  const x0 = box!.x + box!.width * 0.6
  const y = box!.y + Math.min(box!.height - 10, withMultiway ? 250 : 30)
  await page.evaluate(() => {
    const w = window as any
    w.__frames = [] as number[]
    w.__longTasks = [] as number[]
    w.__rafOn = true
    const tick = (t: number) => {
      w.__frames.push(t)
      if (w.__rafOn) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
    const obs = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        w.__longTasks.push(e.duration)
      }
    })
    obs.observe({ type: 'longtask' })
    w.__obs = obs
  })
  const cdp = await page.createCDPSession()
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  await cdp.send('Profiler.start')
  const dragStart = Date.now()
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(x0 - i * DRAG_STEP_PX, y)
    await new Promise(r => setTimeout(r, DRAG_STEP_MS))
  }
  await page.mouse.up()
  const dragMs = Date.now() - dragStart
  await new Promise(r => setTimeout(r, 200))
  const { profile } = (await cdp.send('Profiler.stop')) as { profile: Profile }
  const timing = await page.evaluate(() => {
    const w = window as any
    w.__rafOn = false
    w.__obs.disconnect()
    const frames: number[] = w.__frames
    const gaps: number[] = []
    for (let i = 1; i < frames.length; i++) {
      gaps.push(frames[i]! - frames[i - 1]!)
    }
    return { gaps, longTasks: w.__longTasks as number[] }
  })
  const dragGaps = timing.gaps
  const dropped = dragGaps.filter(g => g > 25).length

  console.log(`\n=== ${label} (view ${shape.viewWidth}px) ===`)
  console.log(
    `svg nodes in multiway display: ${shape.svgNodes} (path ${shape.paths}, rect ${shape.rects}, line ${shape.lines}, text ${shape.texts}, title ${shape.titles}); page DOM nodes ${shape.allDom}`,
  )
  const m = stats(split.mobx)
  const r = stats(split.react)
  console.log(
    `per horizontalScroll: MobX chain median ${m.median.toFixed(1)}ms p90 ${m.p90.toFixed(1)} max ${m.max.toFixed(1)} | React flush median ${r.median.toFixed(1)}ms p90 ${r.p90.toFixed(1)} max ${r.max.toFixed(1)}`,
  )
  const g = stats(dragGaps)
  console.log(
    `drag ${dragMs}ms, ${g.n} frames: rAF gap median ${g.median.toFixed(1)}ms p90 ${g.p90.toFixed(1)} max ${g.max.toFixed(1)}; frames >25ms: ${dropped}; long tasks: ${timing.longTasks.length} (max ${Math.max(0, ...timing.longTasks).toFixed(0)}ms)`,
  )
  const attr = attribute(profile)
  console.log(
    `profile: ${attr.total.toFixed(0)}ms sampled\n-- self time by source --`,
  )
  for (const [k, v] of attr.bySource) {
    console.log(
      `${v.toFixed(1).padStart(8)}ms  ${((100 * v) / attr.total).toFixed(0).padStart(3)}%  ${k}`,
    )
  }
  console.log('-- self time by function --')
  for (const [k, v] of attr.byFunction) {
    console.log(
      `${v.toFixed(1).padStart(8)}ms  ${((100 * v) / attr.total).toFixed(0).padStart(3)}%  ${k}`,
    )
  }
  await cdp.detach()
  if (withMultiway) {
    await laneMotion(page, x0, y)
  }
}

interface LaneSample {
  refName: string
  min: number
  max: number
  flipped: boolean
}
interface Sample {
  offsetPx: number
  bpPerPx: number
  // the stack's translate since its last layout; 0 on a build without one
  drag: number
  lanes: Record<string, LaneSample | null>
  laneGenesKey: string
  isLoading: boolean
}

const READ_SAMPLE = `(() => {
  const view = window.JBrowseSession.views[0]
  const display = view.tracks.find(t => t.configuration.trackId === 'grape_peach_cacao_blocks').displays[0]
  const lanes = {}
  for (const [name, f] of display.rowFrames) {
    lanes[name] = f ? { refName: f.refName, min: f.min, max: f.max, flipped: f.flipped } : null
  }
  return { offsetPx: view.offsetPx, bpPerPx: view.bpPerPx, drag: display.dragOffsetPx ?? 0, lanes, laneGenesKey: display.laneGenesKey, isLoading: display.isLoading }
})`

function lanePx(s: LaneSample, bp: number, width: number) {
  const t = (bp - s.min) / (s.max - s.min)
  return s.flipped ? width * (1 - t) : width * t
}

// how far a lane's picture moved on screen between two samples, in px,
// measured at the bp that sat at the lane's centre in the first sample
function laneShiftPx(a: Sample, b: Sample, name: string, width: number) {
  const la = a.lanes[name]
  const lb = b.lanes[name]
  if (!la || !lb || la.refName !== lb.refName || la.flipped !== lb.flipped) {
    return undefined
  }
  const centreBp = (la.min + la.max) / 2
  return (
    lanePx(lb, centreBp, width) +
    b.drag -
    (lanePx(la, centreBp, width) + a.drag)
  )
}

async function laneMotion(page: Page, x0: number, y: number) {
  const width = (await page.evaluate(
    () => (window as any).JBrowseSession.views[0].width,
  )) as number
  // a second drag, sampled per frame
  await page.addScriptTag({ content: `window.__readSample = ${READ_SAMPLE}` })
  await page.evaluate(() => {
    const w = window as any
    w.__samples = [] as Sample[]
    w.__sampling = true
    const read = w.__readSample as () => Sample
    const tick = () => {
      w.__samples.push(read())
      if (w.__sampling) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(x0 - i * DRAG_STEP_PX, y)
    await new Promise(r => setTimeout(r, DRAG_STEP_MS))
  }
  await page.mouse.up()
  const during = await page.evaluate(() => {
    const w = window as any
    w.__sampling = false
    return w.__samples as Sample[]
  })
  // then the settle
  const settleTrace: { t: number; s: Sample }[] = []
  const t0 = Date.now()
  while (Date.now() - t0 < 2500) {
    settleTrace.push({
      t: Date.now() - t0,
      s: (await page.evaluate('window.__readSample()')) as Sample,
    })
    await new Promise(r => setTimeout(r, 50))
  }

  console.log('\n-- during the drag: per-frame lane motion vs the anchor --')
  const laneNames = Object.keys(during[0]!.lanes)
  const anchorSteps = during
    .slice(1)
    .map((s, i) => -(s.offsetPx - during[i]!.offsetPx))
  const moving = anchorSteps.filter(d => d !== 0)
  console.log(
    `anchor moved on ${moving.length}/${anchorSteps.length} frames, ${stats(moving.map(Math.abs)).median.toFixed(1)}px per moving frame`,
  )
  for (const name of laneNames) {
    const rel: number[] = []
    let laneMoves = 0
    let discrete = 0
    for (let i = 1; i < during.length; i++) {
      const shift = laneShiftPx(during[i - 1]!, during[i]!, name, width)
      if (shift === undefined) {
        discrete++
        continue
      }
      if (shift !== 0) {
        laneMoves++
      }
      if (anchorSteps[i - 1] !== 0) {
        rel.push(shift - anchorSteps[i - 1]!)
      }
    }
    const relAbs = stats(rel.map(Math.abs))
    const sizes = new Set<number>()
    for (let i = 1; i < during.length; i++) {
      const shift = laneShiftPx(during[i - 1]!, during[i]!, name, width)
      if (shift) {
        sizes.add(Math.round(shift))
      }
    }
    console.log(
      `${name.padEnd(12)} moved on ${laneMoves} frames in steps of {${[...sizes].sort((a, b) => a - b).join(',')}}px; slip vs anchor per moving frame: median ${relAbs.median.toFixed(1)}px max ${relAbs.max.toFixed(1)}px${discrete ? `; ${discrete} contig/orientation changes mid-drag` : ''}`,
    )
  }

  console.log('-- at settle (2.5s after mouseup) --')
  const last = during.at(-1)!
  const final = settleTrace.at(-1)!.s
  for (const name of laneNames) {
    const a = last.lanes[name]
    const b = final.lanes[name]
    const notes: string[] = []
    if (!a || !b) {
      notes.push(`${a ? 'lane' : 'empty'} -> ${b ? 'lane' : 'empty'}`)
    } else {
      if (a.refName !== b.refName) {
        notes.push(`contig ${a.refName} -> ${b.refName}`)
      }
      if (a.flipped !== b.flipped) {
        notes.push(`MIRRORED`)
      }
      const ra = (a.max - a.min) / (last.bpPerPx * width)
      const rb = (b.max - b.min) / (final.bpPerPx * width)
      if (Math.abs(ra - rb) > 0.01) {
        notes.push(`rung ${ra.toFixed(1)}x -> ${rb.toFixed(1)}x`)
      }
      const shift = laneShiftPx(last, final, name, width)
      if (shift !== undefined && Math.abs(shift) >= 1) {
        notes.push(`slid ${shift.toFixed(0)}px`)
      }
    }
    console.log(
      `${name.padEnd(12)} ${notes.length ? notes.join(', ') : 'held still'}`,
    )
  }
  const keyChangedAt = settleTrace.find(
    e => e.s.laneGenesKey !== last.laneGenesKey,
  )?.t
  const loadingSpan = settleTrace.filter(e => e.s.isLoading)
  console.log(
    `lane gene refetch: ${keyChangedAt === undefined ? 'none' : `key changed at +${keyChangedAt}ms`}; isLoading seen ${loadingSpan.length ? `from +${loadingSpan[0]!.t}ms to +${loadingSpan.at(-1)!.t}ms` : 'never'}`,
  )
  const frameChangeTimes = settleTrace
    .filter(
      (e, i) =>
        i > 0 &&
        JSON.stringify(e.s.lanes) !==
          JSON.stringify(settleTrace[i - 1]!.s.lanes),
    )
    .map(e => `+${e.t}ms`)
  console.log(
    `lane frames changed after mouseup at: ${frameChangeTimes.length ? frameChangeTimes.join(' ') : 'never'}`,
  )

  console.log('-- zoom out, 12 steps of 12% (what a wheel does) --')
  const zoomTrace: { mobx: number; react: number; s: Sample }[] = []
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate(async () => {
      const view = (window as any).JBrowseSession.views[0]
      const t0 = performance.now()
      view.zoomTo(view.bpPerPx * 1.12)
      const t1 = performance.now()
      await Promise.resolve()
      await Promise.resolve()
      const t2 = performance.now()
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))
      return {
        mobx: t1 - t0,
        react: t2 - t1,
        s: ((window as any).__readSample as () => Sample)(),
      }
    })
    zoomTrace.push(r)
    await new Promise(r => setTimeout(r, 120))
  }
  await new Promise(r => setTimeout(r, 1500))
  const afterZoom = (await page.evaluate('window.__readSample()')) as Sample
  console.log(
    `per zoom step: MobX median ${stats(zoomTrace.map(z => z.mobx)).median.toFixed(1)}ms, React median ${stats(zoomTrace.map(z => z.react)).median.toFixed(1)}ms`,
  )
  for (const name of laneNames) {
    let rungChanges = 0
    let flips = 0
    let contigs = 0
    let empties = 0
    const rungs: string[] = []
    let prev: LaneSample | null = last.lanes[name]
    let prevBpPerPx = last.bpPerPx
    for (const z of [...zoomTrace.map(z => z.s), afterZoom]) {
      const cur = z.lanes[name]
      if (!cur || !prev) {
        if (!cur) {
          empties++
        }
      } else {
        const ra = (prev.max - prev.min) / (prevBpPerPx * width)
        const rb = (cur.max - cur.min) / (z.bpPerPx * width)
        if (Math.abs(ra - rb) > 0.01) {
          rungChanges++
        }
        rungs.push(rb.toFixed(1))
        if (cur.flipped !== prev.flipped) {
          flips++
        }
        if (cur.refName !== prev.refName) {
          contigs++
        }
      }
      prev = cur
      prevBpPerPx = z.bpPerPx
    }
    console.log(
      `${name.padEnd(12)} rung changed ${rungChanges}x (rungs seen: ${[...new Set(rungs)].join(' ')}), mirrored ${flips}x, contig changed ${contigs}x${empties ? `, empty on ${empties} steps` : ''}`,
    )
  }
  const keys = new Set([
    last.laneGenesKey,
    ...zoomTrace.map(z => z.s.laneGenesKey),
    afterZoom.laneGenesKey,
  ])
  console.log(
    `distinct lane-gene fetch keys across the 12 zoom steps: ${keys.size - 1} refetches`,
  )
}

const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: BASE_CHROME_ARGS,
  defaultViewport: VIEWPORT,
})
try {
  const page = await browser.newPage()
  page.on('pageerror', e => {
    console.error('pageerror', e.message)
  })
  if (process.env.CONTROL) {
    await runArm(page, 'control: LGV + grape gene track only', false)
  }
  await runArm(page, 'multiway: tutorial session, 6 mate lanes', true)
} finally {
  await browser.close()
  server.close()
}
