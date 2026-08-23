// What does marking the ribbons the band is culling cost?
//
//   node plugins/linear-comparative-view/benches/culledRibbonMates.bench.ts
//
// The harness rules — min-of-rounds, run a control, check identity before
// believing timing — are in `agent-docs/reference/BENCHMARKING.md`. Node rather
// than jest, for the reason that file measures: these are typed-array reads in
// a loop, the shape jest inflates 6-30x.
//
// THE QUESTION. `offscreenMateOverlay.bench.ts` prices the strip a WORKER tally
// produces. This one prices the other class (`culledRibbonMates`), which is
// decided on the main thread: it costs one pass over the instances per fetch,
// and one comparison per entry per repaint. Both are new work on a setting that
// is on by default, so both need a number rather than an argument.
//
// ARMS:
//   build      one `culledRibbonMateData`, which is the per-FETCH half
//   repaint    one overlay repaint with the facing row scrolled clear of every
//              mate, so nothing is culled from the walk and every entry is a
//              mark. The ceiling.
//   control    the same repaint with the mate lane removed, which is exactly
//              what a class A dataset of the same size costs. Two columns that
//              track each other say the band test is free and the cost is the
//              rect-per-mark repaint both classes already had.
//   covered    the state a reader is actually in most of the time: a facing row
//              whose band spans every mate the fetch holds. `mateAxis`'s extent
//              is what turns that into two comparisons, and this column is what
//              says whether that is worth its bytes.
//   hover      a pointer over the ribbons, below the strip. Unchanged by any of
//              this, and here to prove it.
//
// WHAT IT SAYS: agent-docs/measurements/culled-ribbon-mates.json.
import { culledRibbonMateData } from '../src/LinearSyntenyDisplay/culledRibbonMates.ts'
import {
  drawOffscreenMates,
  offscreenMateAt,
} from '../src/LinearSyntenyDisplay/drawOffscreenMates.ts'

const ROUNDS = 15
const WIDTH = 1500
const HEIGHT = 100
const GENOME_BP = 500_000_000
// Three per feature is a CIGAR-bearing block: the base trapezoid plus a couple
// of indel quads. The build walks instances, so this is what it walks.
const INSTANCES_PER_FEATURE = 3

// Every query span inside one 2Mb window at 2000bp/px, so every mark lands on
// screen and nothing is rejected before the walk. Mates are spread over a whole
// genome by a stride coprime with the count, which is what a facing row can
// scroll clear of.
function geometry(features: number) {
  const n = features * INSTANCES_PER_FEATURE
  const bp1 = new Float32Array(n)
  const bp2 = new Float32Array(n)
  const bp3 = new Float32Array(n)
  const bp4 = new Float32Array(n)
  const instanceFeatureIdx = new Uint32Array(n)
  const alignmentLengths = new Float32Array(n)
  let k = 0
  for (let f = 0; f < features; f++) {
    const q = (f / features) * 2_000_000
    const m = (f * 7919) % GENOME_BP
    for (let j = 0; j < INSTANCES_PER_FEATURE; j++) {
      bp1[k] = q + j * 100
      bp2[k] = q + j * 100 + 80
      bp3[k] = m + j * 100
      bp4[k] = m + j * 100 + 80
      instanceFeatureIdx[k] = f
      alignmentLengths[k] = 1000
      k++
    }
  }
  return {
    bp1,
    bp2,
    bp3,
    bp4,
    base0: 0,
    base1: 0,
    kinds: new Uint8Array(n),
    instanceFeatureIdx,
    alignmentLengths,
    instanceCount: n,
  }
}

function features(n: number) {
  const mateRefNameDict = Array.from(
    { length: 20 },
    (_, i) => `NC_0818${10 + i}.1`,
  )
  return {
    mateRefNameDict,
    mateRefNameIds: Uint32Array.from({ length: n }, (_, i) => i % 20),
    mateStarts: Uint32Array.from({ length: n }, (_, i) => i * 10),
    mateEnds: Uint32Array.from({ length: n }, (_, i) => i * 10 + 500),
  }
}

const noop = () => {}
// The fill is a no-op, so rasterization is not in any column here — what these
// measure is layout and path building, the same boundary the overlay bench draws.
const ctx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineJoin: '',
  font: '',
  textBaseline: '',
  beginPath: noop,
  rect: noop,
  fill: noop,
  measureText: (text: string) => ({ width: text.length * 6 }),
  strokeText: noop,
  fillText: noop,
} as unknown as CanvasRenderingContext2D

function min(fn: () => void) {
  let best = Infinity
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now()
    fn()
    best = Math.min(best, performance.now() - t)
  }
  return best
}

const band = {
  width: WIDTH,
  height: HEIGHT,
  markColor: '#000',
  labelColor: '#000',
  haloColor: '#fff',
}
const lane = {
  bpPerPx: 2000,
  offsetPx: 0,
  side: 'top' as const,
  minAlignmentLength: 0,
}

console.log(
  ['features', 'instances', 'build', 'repaint', 'control', 'covered', 'hover']
    .map(s => s.padStart(10))
    .join(''),
)
for (const count of [10_000, 50_000, 100_000, 250_000, 500_000]) {
  const geom = geometry(count)
  const feats = features(count)
  const build = min(() => {
    culledRibbonMateData(geom, feats)
  })
  const data = culledRibbonMateData(geom, feats)

  const clear = { lo: GENOME_BP * 2, hi: GENOME_BP * 2 + 1_000_000 }
  const repaint = min(() => {
    drawOffscreenMates(
      ctx,
      [{ ...lane, datasets: [data], mateBand: clear }],
      band,
    )
  })

  const { mateAxis, ...noMateAxis } = data
  const control = min(() => {
    drawOffscreenMates(ctx, [{ ...lane, datasets: [noMateAxis] }], band)
  })

  const covering = { lo: -1, hi: GENOME_BP * 4 }
  const covered = min(() => {
    const may = mateAxis.lo < covering.lo || mateAxis.hi > covering.hi
    drawOffscreenMates(
      ctx,
      may ? [{ ...lane, datasets: [data], mateBand: covering }] : [],
      band,
    )
  })

  const hover = min(() => {
    offscreenMateAt(
      {
        ...lane,
        datasets: [data],
        mateBand: clear,
        width: WIDTH,
        height: HEIGHT,
      },
      700,
      HEIGHT / 2,
    )
  })

  console.log(
    [
      count,
      count * INSTANCES_PER_FEATURE,
      build.toFixed(2),
      repaint.toFixed(2),
      control.toFixed(2),
      covered.toFixed(3),
      hover.toFixed(3),
    ]
      .map(s => String(s).padStart(10))
      .join(''),
  )
}
