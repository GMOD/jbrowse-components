/* eslint-disable no-console */
// Manual probe (`node --experimental-strip-types`, needs a jbrowse-web build):
// does `contain: strict` on TrackRenderingContainer earn its keep? It is the
// reason every piece of display chrome reaches the track's overlay layer through
// `TrackOverlayPortal` rather than a plain z-index — containment creates a
// stacking context, and nothing inside one can paint above a later sibling.
//
// Method: one page, one build, one session. The only thing that changes between
// arms is an injected stylesheet, flipped between traced batches, so every arm
// sees the same layout, the same data and the same machine load. Metric is
// devtools.timeline event counts and summed durations per batch — counts are
// structural and survive a loaded box; absolute ms does not. Ratios of medians,
// arms rotated so warm-up is shared.
//
// ANSWERED 2026-08-06 — ADR-058, which is where the reasoning lives; this is
// the harness and the raw numbers. On the real DOM every arm ties (±6%, tracks
// hold ~20 nodes each, so containment has nothing to skip). Under `HEAVY=300` —
// 300 nodes stuffed into each track, standing in for the DOM-heavy displays we
// do have (tree sidebar row labels, legends) — `paintMs` relative to strict,
// across five runs, headless and headed on a real GPU:
//
//   zoom         clip 3.6-4.6x   layoutOnly 0.94x        paintOnly 0.93x
//   pan          clip 4.0-4.8x   layoutOnly 0.99-1.49x   paintOnly 1.00-1.43x
//   heightChurn  clip 2.4-2.6x   layoutOnly 0.98x        paintOnly 0.97x
//   viewResize   clip 0.98-1.11x layoutOnly 0.99-1.59x   paintOnly 0.99-1.11x
//
// Paint COUNTS are identical across arms everywhere; only time per paint moves,
// i.e. the invalidated area grows past the track. `layoutOnly`
// (contain: layout style) ties with strict despite having no paint containment,
// so the isolation comes from the **stacking context** that layout and paint
// containment each create — `clip` is the only arm without one. That is the
// whole finding: the stacking context IS the paint isolation, so "let chrome use
// z-index instead of portals" and "keep the isolation" are one knob in two
// positions. Narrowing strict to `contain: paint` measured free but wins
// nothing and still creates the context, so it removes no portal.
//
// viewportResize is the lone flat row: the whole document relayouts and repaints
// regardless, leaving per-track isolation nothing to save. Its non-paint columns
// are also the noisiest, especially headed — read paintMs, not layoutMs.
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const REPS = Number(process.env.REPS || 5)

// `HEADLESS=0` (with DISPLAY set) runs on the real GPU. Worth re-checking a
// result here at least once: headless Chrome can fall back to software raster,
// and this probe's whole metric is paint time — the one thing a software
// rasterizer would exaggerate. Logs the renderer so a result says which it was.
const HEADLESS = process.env.HEADLESS !== '0'

// A mix on purpose: canvas displays have almost no DOM, so a containment win
// would have to come from the chrome/overlay trees rather than the data.
const TRACKS = [
  'volvox_alignments',
  'volvox_bam_snpcoverage',
  'volvox_bam_pileup',
  'volvox_cram_alignments',
  'volvox_cram_snpcoverage',
  'volvox_microarray',
  'volvox_microarray_multi',
  'volvox_microarray_multi_multirowxy',
  'volvox_microarray_multi_multirowdensity',
  'volvox_microarray_line',
  'volvox_microarray_density',
  'volvox_test_vcf',
  'volvox_filtered_vcf',
  'volvox_gc',
  'volvox_sv_test',
  'volvox_gwas',
  'nclist_long_names',
  'volvox-long-reads-sv-bam',
]

const SEL = '[data-testid^="trackRenderingContainer-"]'
const ARMS = {
  // ships today: contain: strict === size + layout + paint + style
  strict: '',
  // the candidate: clip without a scroll container and without a stacking
  // context, so display chrome could use a plain z-index instead of a portal
  clip: `${SEL} { contain: none !important; overflow: clip !important; }`,
  // which half pays? layout containment without paint containment...
  layoutOnly: `${SEL} { contain: layout style !important; overflow: clip !important; }`,
  // ...versus paint containment without layout containment
  paintOnly: `${SEL} { contain: paint !important; }`,
}

type Arm = keyof typeof ARMS

interface Batch {
  layout: number
  layoutMs: number
  recalc: number
  recalcMs: number
  paint: number
  paintMs: number
}

async function setArm(page: Page, arm: Arm) {
  await page.evaluate(css => {
    let el = document.getElementById('zz-ab-style')
    if (!el) {
      el = document.createElement('style')
      el.id = 'zz-ab-style'
      document.head.append(el)
    }
    el.textContent = css
  }, ARMS[arm])
  // let the style change settle before the traced batch starts
  await new Promise(r => setTimeout(r, 300))
}

function summarize(events: any[]): Batch {
  const b: Batch = {
    layout: 0,
    layoutMs: 0,
    recalc: 0,
    recalcMs: 0,
    paint: 0,
    paintMs: 0,
  }
  for (const e of events) {
    const dur = (e.dur || 0) / 1000
    if (e.name === 'Layout') {
      b.layout++
      b.layoutMs += dur
    } else if (e.name === 'UpdateLayoutTree') {
      b.recalc++
      b.recalcMs += dur
    } else if (e.name === 'Paint') {
      b.paint++
      b.paintMs += dur
    }
  }
  return b
}

async function traced(page: Page, fn: () => Promise<void>): Promise<Batch> {
  await page.tracing.start({
    categories: ['devtools.timeline'],
    screenshots: false,
  })
  await fn()
  // Uint8Array, not Buffer — `.toString()` on it yields comma-joined bytes
  const buf = await page.tracing.stop()
  const trace = JSON.parse(new TextDecoder().decode(buf))
  return summarize(trace.traceEvents)
}

// --- the three gestures, each hitting a different part of the pipeline -------

// full-document relayout: the case containment is supposed to help most, since
// layout must decide whether to descend into every track's subtree
async function viewportResize(page: Page) {
  for (let i = 0; i < 8; i++) {
    await page.setViewport({ width: 1400 - (i % 4) * 60, height: 900 })
    await new Promise(r => setTimeout(r, 120))
  }
}

// horizontal pan: transforms on gridlines/padding blocks plus canvas redraws.
// Alternates direction — dragging the same way every time walks the view to the
// end of the contig, after which the gesture is a no-op and both arms report
// zero work, which reads exactly like "no difference".
let panDir = 1
async function pan(page: Page) {
  for (let rep = 0; rep < 3; rep++) {
    panDir = -panDir
    await page.mouse.move(700, 400)
    await page.mouse.down()
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(700 - panDir * i * 12, 400)
      await new Promise(r => setTimeout(r, 16))
    }
    await page.mouse.up()
    await new Promise(r => setTimeout(r, 100))
  }
}

// The case containment is actually FOR: a track changes height, so every track
// below it moves and the document relayouts. Driven through the model rather
// than a drag on the resize handle so it can't silently miss the target.
async function heightChurn(page: Page) {
  for (let i = 0; i < 12; i++) {
    await page.evaluate(
      h => {
        const v = (globalThis as any).JBrowseSession?.views?.[0]
        for (const t of v?.tracks?.slice(0, 4) || []) {
          t.displays[0]?.setHeight?.(h)
        }
      },
      100 + (i % 3) * 60,
    )
    await new Promise(r => setTimeout(r, 80))
  }
}

// Zoom: every display redraws its canvas at a new scale, and the block geometry
// under the tracks (gridlines, padding masks, scalebar ticks) is rebuilt with
// it. Driven through the model, and kept inside data that's already loaded — a
// zoom that refetches would time the worker, not the compositor. Returns to
// where it started so reps don't drift toward one end of the range.
async function zoom(page: Page) {
  for (const bp of [36, 24, 16, 10, 6, 10, 16, 24, 36, 24, 16, 36]) {
    await page.evaluate(b => {
      ;(globalThis as any).JBrowseSession?.views?.[0]?.zoomTo?.(b)
    }, bp)
    await new Promise(r => setTimeout(r, 120))
  }
}

const SCENARIOS = { viewportResize, heightChurn, pan, zoom }

// A gesture that silently does nothing reports zero layout/paint work in BOTH
// arms, which reads exactly like "containment makes no difference". Check the
// view actually moved.
async function viewState(page: Page) {
  return page.evaluate(() => {
    const v = (globalThis as any).JBrowseSession?.views?.[0]
    return {
      offsetPx: v?.offsetPx,
      bpPerPx: v?.bpPerPx,
      scrollTop: document.querySelector('[data-testid="trackContainer"]')
        ?.scrollTop,
      pageScroll: globalThis.scrollY,
    }
  })
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2
    ? s[(s.length - 1) / 2]!
    : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}

async function main() {
  const { server, port } = await startServerOnFreePort(3399)
  const browser = await launch({
    headless: HEADLESS,
    args: BASE_CHROME_ARGS,
    defaultViewport: { width: 1400, height: 900 },
  })
  try {
    const page = await browser.newPage()
    const spec = {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: TRACKS,
        },
      ],
    }
    await page.goto(
      `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=ab&renderer=canvas2d`,
      { waitUntil: 'networkidle0', timeout: 90000 },
    )
    await page
      .waitForSelector('[data-display-drawn="true"]', { timeout: 60000 })
      .catch(() => {
        console.log('WARN: no display reported drawn')
      })
    await new Promise(r => setTimeout(r, 3000))

    // context for reading the result: how much DOM is actually inside a track,
    // i.e. how much subtree containment has to skip
    const domStats = await page.evaluate(() => {
      const els = [
        ...document.querySelectorAll(
          '[data-testid^="trackRenderingContainer-"]',
        ),
      ]
      return {
        tracks: els.length,
        nodesPerTrack: els.map(e => e.querySelectorAll('*').length),
        total: document.querySelectorAll('*').length,
      }
    })
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'none'
    })
    console.log(
      `${HEADLESS ? 'headless' : 'headed'} | gpu: ${renderer}\ntracks=${domStats.tracks} nodes/track=[${domStats.nodesPerTrack.join(',')}] documentNodes=${domStats.total}`,
    )

    // Synthetic heavy-DOM arm. Canvas displays hold ~20 nodes each, so real
    // sessions give containment almost nothing to skip; HEAVY=n stuffs n
    // positioned nodes into every track so the "does layout descend into the
    // subtree" question is actually asked. Artificial, and labeled as such — but
    // if containment doesn't pay here it can't pay on the real DOM either.
    const heavy = Number(process.env.HEAVY || 0)
    if (heavy) {
      await page.evaluate(n => {
        for (const c of document.querySelectorAll(
          '[data-testid^="trackRenderingContainer-"]',
        )) {
          const frag = document.createDocumentFragment()
          for (let i = 0; i < n; i++) {
            const d = document.createElement('div')
            // labeled, because HEADLESS=0 puts these on a real screen and 300
            // anonymous nodes per track look exactly like a rendering bug
            d.textContent = `probe-dom ${i}`
            d.style.cssText = `position:absolute;left:${(i * 7) % 900}px;top:${(i * 3) % 200}px;font-size:9px;color:magenta`
            frag.append(d)
          }
          c.append(frag)
        }
      }, heavy)
      await new Promise(r => setTimeout(r, 500))
      const after = await page.evaluate(
        () => document.querySelectorAll('*').length,
      )
      console.log(`HEAVY=${heavy} injected -> documentNodes=${after}`)
    }
    console.log()

    const armNames = Object.keys(ARMS) as Arm[]
    const results: Record<string, Record<string, Batch[]>> = {}
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      const perArm: Record<string, Batch[]> = Object.fromEntries(
        armNames.map(a => [a, []]),
      )
      results[name] = perArm
      for (let rep = 0; rep < REPS; rep++) {
        // rotate which arm goes first so warm-up and drift are shared evenly
        const order = armNames.map(
          (_, i) => armNames[(i + rep) % armNames.length]!,
        )
        for (const arm of order) {
          await setArm(page, arm)
          const before = await viewState(page)
          perArm[arm]!.push(await traced(page, () => fn(page)))
          const after = await viewState(page)
          if (JSON.stringify(before) === JSON.stringify(after)) {
            console.log(
              `  !! ${name}/${arm} rep${rep}: view unchanged ${JSON.stringify(after)}`,
            )
          }
        }
      }
    }

    for (const [name, arms] of Object.entries(results)) {
      console.log(`\n== ${name} (${REPS} interleaved reps) ==`)
      for (const key of [
        'recalc',
        'recalcMs',
        'layout',
        'layoutMs',
        'paint',
        'paintMs',
      ] as (keyof Batch)[]) {
        const base = median(arms.strict!.map(b => b[key]))
        const cells = armNames.map(a => {
          const v = median(arms[a]!.map(b => b[key]))
          const ratio = base === 0 ? (v === 0 ? 1 : Infinity) : v / base
          return `${a}=${v.toFixed(1)} (${ratio.toFixed(2)}x)`.padEnd(26)
        })
        console.log(`  ${key.padEnd(9)} ${cells.join('')}`)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
  process.exit(0)
}

void main()
