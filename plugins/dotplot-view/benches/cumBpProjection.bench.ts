// What does consolidating the cumBp -> px reconstruction cost the Canvas2D
// dotplot loop?
//
//   node plugins/dotplot-view/benches/cumBpProjection.bench.ts
//   node plugins/dotplot-view/benches/cumBpProjection.bench.ts --rounds=15
//
// `(cumBp - viewBp) * bpPerPxInv`, with the v axis flipped through the plot
// height, is written out four times: `drawDotplotInstances`, the pick engine's
// exact test, `DotplotDisplay.hoveredFeatureHighlight`, and the Slang shader.
// The shader can't share, but the three JS copies could — and the reason given
// for not extracting them was that `drawDotplotInstances` runs over 10^5+
// segments a frame. That was reasoning, not a measurement, and the sibling
// benches are here because that class of reasoning has been wrong before
// (`InstanceWriter.push`, "just typed-array stores", off by 2.3x).
//
// Three candidate shapes, because they fail differently:
//
// - SCALAR: `cumBpToPxH(bp, viewBp, inv)` — primitives only, so no property
//   access and nothing to go polymorphic. The cheapest thing that could work,
//   and the one that dedups least: each call site still spells the v-axis flip.
// - CLOSURE: a factory returning `px`/`py` closures over the captured
//   primitives, built once outside the loop. Reads best at the call site and
//   keeps the flip inside the shared definition.
// - OBJECT: one `projectSegment(g, i, transform)` taking the transform as an
//   object. Deduplicates the most — the whole four-coordinate pair, in one
//   place — and is the shape at risk, because the three real call sites hold
//   three DIFFERENT object shapes (`DotplotDrawParams`, `DotplotPickTransform`,
//   `plotTransform`), so the shared function's property loads go megamorphic.
//   The arm below warms it on all three shapes for that reason; warming it on
//   one would measure a function that does not exist.
//
// WHAT IS MODELLED. The four reads, the four projections, the offscreen cull
// (which drops ~87% of a real fetch — see the comment in `drawDotplot.ts`) and
// the packed-color read the batcher compares on. What is NOT modelled is
// `ctx.moveTo`/`lineTo`/`stroke`, which node has no canvas for and which is real
// work any overhead here would be diluted against. So a ratio is an UPPER BOUND
// on the projection's share of the real loop.
//
// Same four rules as the sibling benches — separate drivers per arm, a control
// arm that is the baseline declared twice, min of interleaved rounds, identity
// before timing. See `agent-docs/reference/BENCHMARKING.md`.
export {}

interface Geometry {
  x1: Float64Array
  y1: Float64Array
  x2: Float64Array
  y2: Float64Array
  colors: Uint32Array
  instanceCount: number
}

// The three real transform shapes, so the OBJECT arm's property loads see what
// they would see in the tree rather than one tidy hidden class.
interface DrawParams {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  viewWidth: number
  viewHeight: number
  lineWidth: number
  alpha: number
}
interface PickTransform {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  viewHeight: number
  bpPerPxH: number
  bpPerPxV: number
}
interface PlotTransform {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  viewHeight: number
}

// --- the three candidate consolidations ---

function cumBpToPxH(cumBp: number, viewBpH: number, bpPerPxHInv: number) {
  return (cumBp - viewBpH) * bpPerPxHInv
}
function cumBpToPxV(
  cumBp: number,
  viewBpV: number,
  bpPerPxVInv: number,
  viewHeight: number,
) {
  return viewHeight - (cumBp - viewBpV) * bpPerPxVInv
}

function makeProjector(t: {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  viewHeight: number
}) {
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewHeight } = t
  return {
    px: (cumBp: number) => (cumBp - viewBpH) * bpPerPxHInv,
    py: (cumBp: number) => viewHeight - (cumBp - viewBpV) * bpPerPxVInv,
  }
}

// The four-coordinate version, written into a caller-owned scratch tuple so the
// shape that dedups most is not also the one paying an allocation per segment.
function projectSegment(
  g: Geometry,
  i: number,
  t: {
    viewBpH: number
    viewBpV: number
    bpPerPxHInv: number
    bpPerPxVInv: number
    viewHeight: number
  },
  out: Float64Array,
) {
  out[0] = (g.x1[i]! - t.viewBpH) * t.bpPerPxHInv
  out[1] = t.viewHeight - (g.y1[i]! - t.viewBpV) * t.bpPerPxVInv
  out[2] = (g.x2[i]! - t.viewBpH) * t.bpPerPxHInv
  out[3] = t.viewHeight - (g.y2[i]! - t.viewBpV) * t.bpPerPxVInv
}

// Identical source, its own function literal, and warmed + called with ONE
// transform shape only. This is the same consolidation as `projectSegment`
// under the precondition the tree does not currently meet: every call site
// holding the same `PlotTransform` rather than three different objects that
// happen to carry the four fields. Separating it is the whole question — if
// this arm is ~1.00 and the polymorphic one is not, then the cost is the SHAPES,
// not the abstraction, and normalizing them buys the full dedup for free.
function projectSegmentMono(
  g: Geometry,
  i: number,
  t: PlotTransform,
  out: Float64Array,
) {
  out[0] = (g.x1[i]! - t.viewBpH) * t.bpPerPxHInv
  out[1] = t.viewHeight - (g.y1[i]! - t.viewBpV) * t.bpPerPxVInv
  out[2] = (g.x2[i]! - t.viewBpH) * t.bpPerPxHInv
  out[3] = t.viewHeight - (g.y2[i]! - t.viewBpV) * t.bpPerPxVInv
}

// --- arms ---

// ARM I: the loop as `drawDotplotInstances` has it today.
function drawInline(g: Geometry, p: DrawParams) {
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewWidth, viewHeight } =
    p
  const { lineWidth } = p
  const { x1, y1, x2, y2, colors, instanceCount } = g
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = (x1[i]! - viewBpH) * bpPerPxHInv
    const sy1 = viewHeight - (y1[i]! - viewBpV) * bpPerPxVInv
    const sx2 = (x2[i]! - viewBpH) * bpPerPxHInv
    const sy2 = viewHeight - (y2[i]! - viewBpV) * bpPerPxVInv
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// CONTROL ARM: byte-identical to I, declared separately so it gets its own
// inline caches. Whatever this scores against I is what the harness can resolve.
function drawInlineControl(g: Geometry, p: DrawParams) {
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewWidth, viewHeight } =
    p
  const { lineWidth } = p
  const { x1, y1, x2, y2, colors, instanceCount } = g
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = (x1[i]! - viewBpH) * bpPerPxHInv
    const sy1 = viewHeight - (y1[i]! - viewBpV) * bpPerPxVInv
    const sx2 = (x2[i]! - viewBpH) * bpPerPxHInv
    const sy2 = viewHeight - (y2[i]! - viewBpV) * bpPerPxVInv
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// ARM S: through the scalar helpers.
function drawScalar(g: Geometry, p: DrawParams) {
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewWidth, viewHeight } =
    p
  const { lineWidth } = p
  const { x1, y1, x2, y2, colors, instanceCount } = g
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = cumBpToPxH(x1[i]!, viewBpH, bpPerPxHInv)
    const sy1 = cumBpToPxV(y1[i]!, viewBpV, bpPerPxVInv, viewHeight)
    const sx2 = cumBpToPxH(x2[i]!, viewBpH, bpPerPxHInv)
    const sy2 = cumBpToPxV(y2[i]!, viewBpV, bpPerPxVInv, viewHeight)
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// ARM C: through a projector built once outside the loop.
function drawClosure(g: Geometry, p: DrawParams) {
  const { viewWidth, viewHeight, lineWidth } = p
  const { px, py } = makeProjector(p)
  const { x1, y1, x2, y2, colors, instanceCount } = g
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = px(x1[i]!)
    const sy1 = py(y1[i]!)
    const sx2 = px(x2[i]!)
    const sy2 = py(y2[i]!)
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// ARM O: through the four-coordinate helper reading the transform as an object.
function drawObject(g: Geometry, p: DrawParams) {
  const { viewWidth, viewHeight, lineWidth } = p
  const { colors, instanceCount } = g
  const out = new Float64Array(4)
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    projectSegment(g, i, p, out)
    const sx1 = out[0]!
    const sy1 = out[1]!
    const sx2 = out[2]!
    const sy2 = out[3]!
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// ARM M: the same four-coordinate helper, one transform shape everywhere.
function drawObjectMono(g: Geometry, p: DrawParams, t: PlotTransform) {
  const { viewWidth, viewHeight, lineWidth } = p
  const { colors, instanceCount } = g
  const out = new Float64Array(4)
  let sink = 0
  for (let i = 0; i < instanceCount; i++) {
    projectSegmentMono(g, i, t, out)
    const sx1 = out[0]!
    const sy1 = out[1]!
    const sx2 = out[2]!
    const sy2 = out[3]!
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      sink += colors[i]! + sx1 + sy1 + sx2 + sy2
    }
  }
  return sink
}

// --- drivers, one per arm. Do not refactor into a shared helper taking the
// implementation as a parameter: that call site goes polymorphic and every arm
// pays for it, which is the first trap in the catalogue.
function timeInline(g: Geometry, p: DrawParams, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawInline(g, p)
  }
  return (performance.now() - t0) / reps
}
function timeControl(g: Geometry, p: DrawParams, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawInlineControl(g, p)
  }
  return (performance.now() - t0) / reps
}
function timeScalar(g: Geometry, p: DrawParams, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawScalar(g, p)
  }
  return (performance.now() - t0) / reps
}
function timeClosure(g: Geometry, p: DrawParams, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawClosure(g, p)
  }
  return (performance.now() - t0) / reps
}
function timeObject(g: Geometry, p: DrawParams, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawObject(g, p)
  }
  return (performance.now() - t0) / reps
}
function timeObjectMono(
  g: Geometry,
  p: DrawParams,
  t: PlotTransform,
  reps: number,
) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawObjectMono(g, p, t)
  }
  return (performance.now() - t0) / reps
}

// A whole-genome-ish fetch: mostly sub-pixel alignments scattered over the plot,
// a spread of packed colors so the batcher's compare is not trivially constant,
// and coordinates well outside the viewport for most of them — the cull drops
// ~87% of a real fetch and the fixture should too.
function makeGeometry(n: number): Geometry {
  const x1 = new Float64Array(n)
  const y1 = new Float64Array(n)
  const x2 = new Float64Array(n)
  const y2 = new Float64Array(n)
  const colors = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const ax = (i * 7919) % 24_000_000
    const ay = (i * 104_729) % 24_000_000
    x1[i] = ax
    y1[i] = ay
    x2[i] = ax + (i % 400)
    y2[i] = ay + (i % 400)
    colors[i] = 0xff000000 | ((i * 2654435761) & 0xffffff)
  }
  return { x1, y1, x2, y2, colors, instanceCount: n }
}

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 7,
)

const params: DrawParams = {
  viewBpH: 1_000_000,
  viewBpV: 1_000_000,
  bpPerPxHInv: 1 / 3000,
  bpPerPxVInv: 1 / 3000,
  viewWidth: 1000,
  viewHeight: 800,
  lineWidth: 1.5,
  alpha: 0.4,
}

const plot: PlotTransform = {
  viewBpH: params.viewBpH,
  viewBpV: params.viewBpV,
  bpPerPxHInv: params.bpPerPxHInv,
  bpPerPxVInv: params.bpPerPxVInv,
  viewHeight: params.viewHeight,
}

// The OBJECT arm's helper is shared by three call sites holding three different
// transform shapes, so warm it on all three before timing. Skipping this
// measures a monomorphic function the tree does not have — which is exactly
// what the MONO arm beside it measures deliberately, warmed on one shape.
{
  const g = makeGeometry(512)
  const out = new Float64Array(4)
  const pick: PickTransform = { ...params, bpPerPxH: 3000, bpPerPxV: 3000 }
  for (let r = 0; r < 2000; r++) {
    for (let i = 0; i < 8; i++) {
      projectSegment(g, i, params, out)
      projectSegment(g, i, pick, out)
      projectSegment(g, i, plot, out)
      projectSegmentMono(g, i, plot, out)
    }
  }
}

{
  const g = makeGeometry(4096)
  const results = [
    drawInline(g, params),
    drawInlineControl(g, params),
    drawScalar(g, params),
    drawClosure(g, params),
    drawObject(g, params),
    drawObjectMono(g, params, plot),
  ]
  const names = ['inline', 'control', 'scalar', 'closure', 'object', 'mono']
  const first = results[0]!
  const bad = results.findIndex(r => r !== first)
  if (bad > 0) {
    throw new Error(
      `arms disagree: ${names[0]} ${first}, ${names[bad]} ${results[bad]}`,
    )
  }
  console.log('identity: all six arms compute the same sum')
}

console.log(
  `\n${'segments'.padStart(10)}  ${'inline'.padStart(7)}  ${'scalar'.padStart(7)}  ` +
    `${'closure'.padStart(7)}  ${'object'.padStart(7)}  ${'mono'.padStart(7)}  ${'control'.padStart(7)}`,
)
for (const n of [500_000, 2_000_000, 5_000_000]) {
  const g = makeGeometry(n)
  const reps = n > 1_000_000 ? 5 : 20
  for (let r = 0; r < 12; r++) {
    timeInline(g, params, 1)
    timeScalar(g, params, 1)
    timeClosure(g, params, 1)
    timeObject(g, params, 1)
    timeObjectMono(g, params, plot, 1)
    timeControl(g, params, 1)
  }
  let inl = Infinity
  let sca = Infinity
  let clo = Infinity
  let obj = Infinity
  let mon = Infinity
  let ctl = Infinity
  for (let round = 0; round < rounds; round++) {
    inl = Math.min(inl, timeInline(g, params, reps))
    sca = Math.min(sca, timeScalar(g, params, reps))
    clo = Math.min(clo, timeClosure(g, params, reps))
    obj = Math.min(obj, timeObject(g, params, reps))
    mon = Math.min(mon, timeObjectMono(g, params, plot, reps))
    ctl = Math.min(ctl, timeControl(g, params, reps))
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${inl.toFixed(2).padStart(7)}  ` +
      `${(sca / inl).toFixed(3).padStart(7)}  ${(clo / inl).toFixed(3).padStart(7)}  ` +
      `${(obj / inl).toFixed(3).padStart(7)}  ${(mon / inl).toFixed(3).padStart(7)}  ` +
      (ctl / inl).toFixed(3).padStart(7),
  )
}
console.log(
  '\ninline is ms per pass; the rest are ratios to it, so above 1.00 means the\n' +
    'consolidation costs. Min of interleaved rounds. A control far from 1.00\n' +
    'means the row measured nothing. `ctx.moveTo`/`lineTo`/`stroke` are not\n' +
    'modelled, so these ratios are an upper bound on the share of the real loop.',
)
