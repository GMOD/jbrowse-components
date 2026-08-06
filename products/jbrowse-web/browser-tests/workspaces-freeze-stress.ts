/* eslint-disable no-console */
// The many-view freeze harness for agent-docs/handoffs/workspaces-freeze.md.
//
// Loads N views x K real volvox tracks in classic and in tiled (dockview) mode
// and reports where the main thread goes: long tasks, frame times, WebGL
// context churn, and GL-API attribution. The freeze only reproduces with real
// tracks on a GPU backend -- an earlier harness used empty views on canvas2d
// and came back clean.
//
//   node browser-tests/workspaces-freeze-stress.ts --views=12 --tracks=3 --mode=classic,tiled
//   node browser-tests/workspaces-freeze-stress.ts --mode=tiled --panels=4
//   node browser-tests/workspaces-freeze-stress.ts --mode=tiled --passes=3 --renderer=canvas2d
//   node browser-tests/workspaces-freeze-stress.ts --mode=tiled --trace=/tmp/t.json  # then analyze-trace.ts
//
// Run each mode in its OWN process when comparing: two runs sharing one node
// process are not comparable (one pairing measured a spurious 2.4x that way).
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

// Where a fresh WebGL2 pipeline's cost lands. Named fields rather than an index
// signature so the report below reads them without an undefined check each.
interface GlTiming {
  getContextMs: number
  compileMs: number
  linkMs: number
  linkStatusMs: number
  programs: number
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? 'true']
    }),
)

const N = Number(args.views ?? 12)
const K = Number(args.tracks ?? 3)
const MODE = args.mode ?? 'both' // classic | tiled | tiled-split | both
const HEADLESS = args.headed !== 'true'
const SETTLE = Number(args.settle ?? 15000)
const PASSES = Number(args.passes ?? 1)
const RENDERER = args.renderer ?? 'webgl'
const TRACE = args.trace
const PATTERN = args.pattern ?? 'sweep'

// Real data, all on ctgA (the volvox fixtures only cover ctgA; ctgB draws
// empty). Long enough to walk `--tracks` up into the context ceiling with a
// single view, which is the shape agent-docs/TODO.md asks about — CRAM (needs a
// reference), the *_nonexist fixtures and the duplicate _folder/_altname
// variants are left out so every entry actually renders.
const TRACK_POOL = [
  'volvox_bam_pileup',
  'volvox_microarray',
  'volvox_filtered_vcf',
  'volvox_bam_snpcoverage',
  'gff3tabix_genes',
  'volvox_gc',
  'volvox_sv_test',
  'volvox_alignments',
  'volvox_gwas',
  'volvox_test_vcf',
  'volvox_microarray_color',
  'volvox_microarray_line',
  'volvox_microarray_density',
  'volvox_microarray_multi',
  'volvox_microarray_multi2',
  'volvox_mouse_inheritance_painting',
  'nclist_long_names',
  'volvox_alignments_grouped_by_strand',
  'volvox_bam_small_max_height',
  'volvox_alignments_pileup_coverage',
  'volvox-long-reads-bam',
  'volvox-long-reads-sv-bam',
  'volvox_samspec',
  'volvox_sv',
]

function views() {
  return Array.from({ length: N }, () => ({
    type: 'LinearGenomeView',
    assembly: 'volvox',
    loc: 'ctgA:1-50000',
    tracks: TRACK_POOL.slice(0, K),
  }))
}

function spec(mode: string) {
  const v = views()
  if (mode === 'classic') {
    return { views: v }
  }
  const P = Number(args.panels ?? 1)
  if (P <= 1) {
    // every view homed into one panel: the shape reconcile produces by default
    return {
      views: v,
      layout: { views: Array.from({ length: N }, (_, i) => i) },
    }
  }
  // P panels side by side, views dealt round-robin
  const per: number[][] = Array.from({ length: P }, () => [])
  for (let i = 0; i < N; i++) {
    per[i % P]!.push(i)
  }
  return {
    views: v,
    layout: {
      direction: 'horizontal',
      children: per.map(ids => ({ views: ids })),
    },
  }
}

// Installed before any app code runs.
function instrument() {
  const w = globalThis as unknown as Record<string, any>
  w.__M = {
    longtasks: [] as number[],
    ctx: { webgl2: 0, webgl: 0, '2d': 0, bitmaprenderer: 0, webgpu: 0 },
    lost: 0,
    restored: 0,
    frames: [] as number[],
  }
  const m = w.__M

  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      m.longtasks.push(Math.round(e.duration))
    }
  }).observe({ entryTypes: ['longtask'] })

  // Attribute GPU-pipeline cost: context acquisition vs shader compile/link.
  // Chrome compiles asynchronously, so the driver stall lands on the
  // getProgramParameter(LINK_STATUS) sync point, not on linkProgram itself.
  m.gl = {
    getContextMs: 0,
    compileMs: 0,
    linkMs: 0,
    linkStatusMs: 0,
    programs: 0,
  }
  const timeIt = (proto: any, name: string, bucket: string) => {
    const f = proto?.[name]
    if (typeof f !== 'function') {
      return
    }
    proto[name] = function (this: unknown, ...a: unknown[]) {
      const t = performance.now()
      const r = f.apply(this, a)
      m.gl[bucket] += performance.now() - t
      return r
    }
  }
  const proto = (globalThis as any).WebGL2RenderingContext?.prototype
  timeIt(proto, 'compileShader', 'compileMs')
  timeIt(proto, 'linkProgram', 'linkMs')
  if (proto?.getProgramParameter) {
    const gp = proto.getProgramParameter
    proto.getProgramParameter = function (this: any, ...a: unknown[]) {
      const t = performance.now()
      const r = gp.apply(this, a)
      m.gl.linkStatusMs += performance.now() - t
      m.gl.programs++
      return r
    }
  }

  const orig = HTMLCanvasElement.prototype.getContext
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const t0 = performance.now()
    const out = (orig as any).call(this, type, ...rest)
    m.gl.getContextMs += performance.now() - t0
    if (out) {
      m.ctx[type] = (m.ctx[type] ?? 0) + 1
      if (type.startsWith('webgl')) {
        this.addEventListener('webglcontextlost', () => {
          m.lost++
        })
        this.addEventListener('webglcontextrestored', () => {
          m.restored++
        })
      }
    }
    return out
  } as typeof HTMLCanvasElement.prototype.getContext

  let last = performance.now()
  const tick = () => {
    const now = performance.now()
    m.frames.push(Math.round(now - last))
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function summarize(frames: number[]) {
  const sorted = [...frames].sort((a, b) => a - b)
  const p = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
  return {
    n: frames.length,
    p50: p(0.5),
    p95: p(0.95),
    max: Math.max(0, ...frames),
    over100: frames.filter(f => f > 100).length,
    over1000: frames.filter(f => f > 1000).length,
  }
}

async function readMetrics(page: Page) {
  return page.evaluate(() => {
    const w = globalThis as unknown as Record<string, any>
    const m = w.__M
    const canvases = document.querySelectorAll('canvas').length
    const containers = document.querySelectorAll(
      '[data-testid^="view-container-"]',
    ).length
    const s = w.JBrowseSession
    return {
      longtasks: m.longtasks as number[],
      ctx: m.ctx as Record<string, number>,
      lost: m.lost as number,
      restored: m.restored as number,
      frames: m.frames as number[],
      gl: m.gl as GlTiming,
      canvases,
      containers,
      views: s?.views?.length ?? -1,
      panels: s?.panelViewAssignments
        ? [...s.panelViewAssignments.keys()].length
        : -1,
      undoStates: w.JBrowseRootModel?.history?.history?.length ?? -1,
    }
  })
}

async function resetCounters(page: Page) {
  await page.evaluate(() => {
    const w = globalThis as unknown as Record<string, any>
    w.__M.longtasks = []
    w.__M.frames = []
    for (const k of Object.keys(w.__M.gl)) {
      w.__M.gl[k] = 0
    }
  })
}

function report(label: string, m: Awaited<ReturnType<typeof readMetrics>>) {
  const lt = m.longtasks
  const total = lt.reduce((a, b) => a + b, 0)
  console.log(`\n===== ${label} =====`)
  console.log(
    `views=${m.views} viewContainers=${m.containers} canvases=${m.canvases}`,
  )
  console.log(
    `contexts: ${JSON.stringify(m.ctx)} lost=${m.lost} restored=${m.restored}`,
  )
  console.log(
    `longtasks: n=${lt.length} totalMs=${total} max=${Math.max(0, ...lt)} over500=${lt.filter(x => x > 500).length}`,
  )
  console.log(`frames: ${JSON.stringify(summarize(m.frames))}`)
  console.log(
    `gl: getContext=${Math.round(m.gl.getContextMs)}ms compile=${Math.round(m.gl.compileMs)}ms link=${Math.round(m.gl.linkMs)}ms linkStatus=${Math.round(m.gl.linkStatusMs)}ms progQueries=${m.gl.programs}`,
  )
  console.log(`panels=${m.panels} undoStates=${m.undoStates}`)
}

async function scrollPass(page: Page, pattern: string) {
  // Scroll whichever container actually scrolls (classic container or the
  // dockview panel).
  //
  // Two patterns, because they ask different questions. `sweep` traverses the
  // whole stack top to bottom: every view crosses the mount band exactly once
  // whatever the hysteresis is, so it measures the floor cost of windowing and
  // is insensitive to rootMargin by construction. `jitter` is reading behavior
  // — short steps down with periodic backtracking, staying within a couple of
  // port heights — which is where a mount band either absorbs the movement or
  // rebuilds a GPU pipeline on every reversal.
  await page.evaluate(async (pat: string) => {
    const el = [...document.querySelectorAll('div')].find(
      d =>
        d.scrollHeight > d.clientHeight + 50 &&
        getComputedStyle(d).overflowY === 'auto',
    )
    if (!el) {
      return
    }
    const wait = () =>
      new Promise(r => {
        setTimeout(r, 150)
      })
    if (pat === 'jitter') {
      const step = Math.floor(el.clientHeight * 0.25)
      let y = 0
      for (let cycle = 0; cycle < 6; cycle++) {
        for (let i = 0; i < 4; i++) {
          y += step
          el.scrollTop = y
          await wait()
        }
        for (let i = 0; i < 2; i++) {
          y -= step
          el.scrollTop = y
          await wait()
        }
      }
      return
    }
    const step = Math.max(100, Math.floor(el.clientHeight * 0.5))
    for (let y = 0; y < el.scrollHeight; y += step) {
      el.scrollTop = y
      await wait()
    }
  }, pattern)
}

async function run(mode: string, port: number) {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--disable-popup-blocking'],
    defaultViewport: { width: 1400, height: 900 },
  })
  try {
    const page = await browser.newPage()
    page.on('pageerror', e => {
      console.log(`  [pageerror] ${e instanceof Error ? e.message : String(e)}`)
    })
    await page.evaluateOnNewDocument(instrument)
    const url = `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(
      spec(mode),
    )}&sessionName=Stress&renderer=${RENDERER}`
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
    // wait for the session to exist, then wrap its actions
    await page.waitForFunction(
      () => (globalThis as any).JBrowseSession?.views?.length > 0,
      { timeout: 120000 },
    )
    await new Promise(r => {
      setTimeout(r, SETTLE)
    })
    console.log(`  (load+settle ${Date.now() - t0}ms)`)
    report(
      `${mode.toUpperCase()} LOAD  N=${N} tracks=${K}`,
      await readMetrics(page),
    )

    for (let pass = 1; pass <= PASSES; pass++) {
      await resetCounters(page)
      if (TRACE && pass === PASSES) {
        await page.tracing.start({
          path: TRACE,
          screenshots: false,
          categories: [
            'devtools.timeline',
            'disabled-by-default-v8.cpu_profiler',
            'v8.execute',
            'toplevel',
          ],
        })
      }
      await scrollPass(page, PATTERN)
      await new Promise(r => {
        setTimeout(r, 2000)
      })
      if (TRACE && pass === PASSES) {
        await page.tracing.stop()
      }
      report(
        `${mode.toUpperCase()} SCROLL#${pass} N=${N} tracks=${K} ${RENDERER}`,
        await readMetrics(page),
      )
    }
  } finally {
    await browser.close()
  }
}

const { server, port } = await startServerOnFreePort(3001)
try {
  const modes = MODE === 'both' ? ['classic', 'tiled'] : MODE.split(',')
  for (const mode of modes) {
    await run(mode, port)
  }
} finally {
  server.close()
}
