// What does the off-screen mate overlay cost the frame it runs in?
//
//   node plugins/linear-comparative-view/benches/offscreenMateOverlay.bench.ts
//   node plugins/linear-comparative-view/benches/offscreenMateOverlay.bench.ts --rounds=15
//
// Flags: --rounds=<n> (default 25), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`. Node
// rather than jest for the reason that file measures: this is a `Float64Array`
// read in a loop, the exact shape jest inflates 6-30x and not uniformly.
//
// THE QUESTION. `offscreenMateHit` runs on every pointer move in a synteny band,
// AHEAD of the ribbon pick, and again on every pointer up. The marks it scans are
// unbounded in the same way the ribbons are — no cap, and `minAlignmentLength` is
// applied at draw time rather than at fetch time — so a level whose target row is
// narrowed to one contig can carry a mark per alignment in the whole query
// genome. The overlay's own repaint is on the same budget.
//
// ARMS, per fixture:
//   hover-ribbons      pointer where it nearly always is: over the ribbons, below
//                      the strip. What ships tests the strip height first.
//   hover-ribbons-old  the same position through the pre-2026-08-19 shape:
//                      lay out every mark, then test each one's y. Transcribed
//                      here because src/ no longer has it.
//   control            a second, separately-declared copy of hover-ribbons-old.
//                      A row whose control is far from 1.00 measured nothing.
//   click-strip        what a CLICK on a mark resolves: the same hit, plus the
//                      union of the mate spans stacked under it, which is a full
//                      scan of the lane rather than the hover's early exit. One
//                      per navigation — the column exists to say whether it could
//                      also be afforded on the hover path, which is where the
//                      tooltip would need it.
//   hover-strip        pointer IN the strip, which is the case neither shape can
//                      answer without scanning, and the ceiling on this path.
//   draw               one overlay repaint — the LAYOUT and path building only.
//                      The fake context's fill is a no-op, so rasterization is
//                      not in this column and a change to how the strip is
//                      painted will not move it.
//   svg                bytes the SVG export's layer serializes to, which IS a
//                      real output and is what a figure carries.
//
// FIXTURES: `demo-2767` is the shape the feature was measured on — peach chr1
// over grape chr1 in demos/grape_peach_cacao, 2767 dropped anchors across 9 grape
// contigs (agent-docs/ideas/offscreen-synteny-mates.md). The other two are the
// query-whole-genome/target-one-contig state, which is where this stops being
// small.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS: see agent-docs/measurements/offscreen-mate-overlay.json, which
// is what the doc tables are generated from. Re-measure with this file and edit
// the record; don't retype the numbers.

import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  drawOffscreenMates,
  offscreenMateAt,
  offscreenMateSpanAt,
} from '../src/LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateLayout } from '../src/LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateData } from '../src/LinearSyntenyRPC/collectOffscreenMates.ts'

const args = process.argv.slice(2)
const flag = (name: string, dflt: number) => {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : dflt
}
const ROUNDS = flag('rounds', 25)
const ONLY = args.find(a => a.startsWith('--only='))?.split('=')[1]
const ALLOW_DIFF = args.includes('--allow-diff')

const WIDTH = 1500
const HEIGHT = 100
const GENOME_BP = 50_000_000

function fixture(n: number, contigs: number): OffscreenMateData {
  const dict = Array.from({ length: contigs }, (_, i) => `NC_0818${10 + i}.1`)
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  const ids = new Uint32Array(n)
  // blocks in contig runs, as a paleopolyploid pattern gives: consecutive
  // anchors share a mate contig, which is what the label merge walks
  const perContig = Math.ceil(n / contigs)
  for (let i = 0; i < n; i++) {
    const start = (i / n) * GENOME_BP
    starts[i] = start
    ends[i] = start + GENOME_BP / n
    ids[i] = Math.floor(i / perContig)
  }
  return {
    mateRefNameDict: dict,
    counts: Uint32Array.from(dict, () => perContig),
    starts,
    ends,
    mateRefNameIds: ids,
    lengths: Float32Array.from({ length: n }, () => GENOME_BP / n),
    mateStarts: Float64Array.from(starts),
    mateEnds: Float64Array.from(ends),
  }
}

const FIXTURES = [
  { name: 'demo-2767', data: fixture(2767, 9) },
  { name: 'stress-50k', data: fixture(50_000, 40) },
  { name: 'stress-250k', data: fixture(250_000, 200) },
].filter(f => !ONLY || f.name.includes(ONLY))

function layoutFor(data: OffscreenMateData): OffscreenMateLayout {
  return {
    datasets: [data],
    bpPerPx: GENOME_BP / WIDTH,
    offsetPx: 0,
    side: 'top',
    minAlignmentLength: 0,
    width: WIDTH,
    height: HEIGHT,
  }
}

// The pre-change hit test, transcribed. Deliberately written out longhand rather
// than sharing anything with the arm above it: a shared driver goes polymorphic
// and every arm pays for it (BENCHMARKING.md).
const MARK_H = 6
const MIN_W = 1.5
function hitOld(layout: OffscreenMateLayout, x: number, y: number) {
  const { bpPerPx, offsetPx, width, height } = layout
  const data = layout.datasets[0]!
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const markHeight = Math.max(1, Math.min(MARK_H, height / 3))
  const rects: { index: number; x: number; width: number; height: number }[] =
    []
  for (let i = 0; i < data.starts.length; i++) {
    const x1 = data.starts[i]! / bpPerPx - offsetPx
    const x2 = data.ends[i]! / bpPerPx - offsetPx
    if (x2 < 0 || x1 > width) {
      continue
    }
    rects.push({
      index: i,
      x: x1,
      width: Math.max(MIN_W, x2 - x1),
      height: markHeight,
    })
  }
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]!
    if (y >= 0 && y <= r.height && x >= r.x && x <= r.x + r.width) {
      return data.mateRefNameDict[data.mateRefNameIds[r.index]!]
    }
  }
  return undefined
}

// The control: the same code as hitOld, declared a second time so it gets its own
// inline caches. Sharing the source text would put them back together.
function hitControl(layout: OffscreenMateLayout, x: number, y: number) {
  const { bpPerPx, offsetPx, width, height } = layout
  const data = layout.datasets[0]!
  if (width <= 0 || height <= 0) {
    return undefined
  }
  const markHeight = Math.max(1, Math.min(MARK_H, height / 3))
  const rects: { index: number; x: number; width: number; height: number }[] =
    []
  for (let i = 0; i < data.starts.length; i++) {
    const x1 = data.starts[i]! / bpPerPx - offsetPx
    const x2 = data.ends[i]! / bpPerPx - offsetPx
    if (x2 < 0 || x1 > width) {
      continue
    }
    rects.push({
      index: i,
      x: x1,
      width: Math.max(MIN_W, x2 - x1),
      height: markHeight,
    })
  }
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]!
    if (y >= 0 && y <= r.height && x >= r.x && x <= r.x + r.width) {
      return data.mateRefNameDict[data.mateRefNameIds[r.index]!]
    }
  }
  return undefined
}

function fakeCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: '',
    lineWidth: 0,
    lineJoin: '',
    fillRect() {},
    beginPath() {},
    rect() {},
    fill() {},
    fillText() {},
    strokeText() {},
    measureText(text: string) {
      return { width: text.length * 6 }
    },
  } as unknown as CanvasRenderingContext2D
}

// A faster hit test that answers differently is not a faster hit test. Sweep the
// band, not just the strip, so the y early-out has to agree everywhere — and
// sweep it at every integer y plus the two half-pixels either side of the strip
// edge, which is the boundary an early-out gets wrong.
const IDENTITY_Y = [
  ...Array.from({ length: HEIGHT + 1 }, (_, i) => i),
  5.5,
  5.9,
  6.1,
  6.5,
  -0.5,
]
function checkIdentity(layout: OffscreenMateLayout, name: string) {
  // the sweep is O(y * x * n), so the stress fixtures get the boundary rows only
  const n = layout.datasets[0]!.starts.length
  const ys = n > 10_000 ? [0, 3, 5.9, 6, 6.1, 60] : IDENTITY_Y
  const step = n > 10_000 ? 97 : 7
  for (const y of ys) {
    for (let x = -20; x <= WIDTH + 20; x += step) {
      const a = offscreenMateAt(layout, x, y)
      const b = hitOld(layout, x, y)
      if (a !== b) {
        const msg = `${name}: hit differs at (${x}, ${y}): ships ${a}, old ${b}`
        if (!ALLOW_DIFF) {
          throw new Error(msg)
        }
        console.log(`  DIFF ${msg}`)
        return
      }
    }
  }
}

const COLORS = {
  markColor: 'rgba(0, 0, 0, 0.35)',
  labelColor: 'grey',
  haloColor: 'white',
}

const HOVERS = 200
const fmt = (n: number) => n.toFixed(3).padStart(8)

// A hit test whose answer nobody reads is a hit test V8 may delete, and the arm
// that reads 0.000 is exactly the one that claim would fake. Every arm feeds this.
let sink = 0
const keep = (v: string | undefined) => {
  sink += v === undefined ? 1 : v.length
}

for (const { name, data } of FIXTURES) {
  const layout = layoutFor(data)
  checkIdentity(layout, name)

  const ctx = fakeCtx()
  const best = {
    hoverRibbons: Infinity,
    hoverRibbonsOld: Infinity,
    control: Infinity,
    hoverStrip: Infinity,
    clickStrip: Infinity,
    draw: Infinity,
  }
  // interleaved round-robin, min of rounds
  for (let round = 0; round < ROUNDS; round++) {
    let t = performance.now()
    for (let i = 0; i < HOVERS; i++) {
      keep(offscreenMateAt(layout, i % WIDTH, 60))
    }
    best.hoverRibbons = Math.min(best.hoverRibbons, performance.now() - t)

    t = performance.now()
    for (let i = 0; i < HOVERS; i++) {
      keep(hitOld(layout, i % WIDTH, 60))
    }
    best.hoverRibbonsOld = Math.min(best.hoverRibbonsOld, performance.now() - t)

    t = performance.now()
    for (let i = 0; i < HOVERS; i++) {
      keep(hitControl(layout, i % WIDTH, 60))
    }
    best.control = Math.min(best.control, performance.now() - t)

    t = performance.now()
    for (let i = 0; i < HOVERS; i++) {
      keep(offscreenMateAt(layout, i % WIDTH, 3))
    }
    best.hoverStrip = Math.min(best.hoverStrip, performance.now() - t)

    t = performance.now()
    for (let i = 0; i < HOVERS; i++) {
      keep(offscreenMateSpanAt(layout, i % WIDTH, 3)?.refName)
    }
    best.clickStrip = Math.min(best.clickStrip, performance.now() - t)

    t = performance.now()
    drawOffscreenMates(ctx, [layout], { ...layout, ...COLORS })
    best.draw = Math.min(best.draw, performance.now() - t)
  }

  const svg = new SvgCanvas()
  drawOffscreenMates(svg, [layout], { ...layout, ...COLORS })
  const svgKb = svg.getSerializedSvg().length / 1024

  console.log(
    `${name.padEnd(12)} hover-ribbons ${fmt(best.hoverRibbons / HOVERS)}  old ${fmt(
      best.hoverRibbonsOld / HOVERS,
    )}  [ctl ${(best.control / best.hoverRibbonsOld).toFixed(2)}]  hover-strip ${fmt(
      best.hoverStrip / HOVERS,
    )}  click-strip ${fmt(
      best.clickStrip / HOVERS,
    )}  draw ${fmt(best.draw)}  svg ${svgKb.toFixed(0).padStart(5)}KB   (ms, per hover except draw)`,
  )
}

// so the sink cannot be optimized out either
if (sink < 0) {
  console.log(sink)
}
