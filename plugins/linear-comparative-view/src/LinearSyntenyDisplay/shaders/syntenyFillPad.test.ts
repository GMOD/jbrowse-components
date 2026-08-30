// Both fill vertex shaders wrap the ribbon in a padded polygon (one quad in
// straight mode, one per bezier segment in curve mode) and clip to the true
// analytic shape in the fragment. If the pad is ever too small the geometry
// crops coverage the fragment would have drawn — ribbons render thinner, with
// hard-cut sides instead of an antialiased edge. Nothing else can catch that:
// the shaders aren't unit-testable and no browser suite exercises either mode.
//
// So this mirrors the `pad` blocks from syntenyFill{Straight,Curve}.slang plus
// the coverage footprint from syntenyTypes.slang, and asserts the invariant both
// shaders rely on: at every y, the padded polygon contains every pixel where
// perpCoverage is non-zero.
// SYNC: keep in step with the `pad` blocks and with perpCoverage/fillEdges.
//
// The polygon modelled here is the one the vertex shaders EMIT, ±1px vertical AA
// row included. That row is the reason this file used to pass over a shader that
// cropped up to a full perpendicular pixel: the model spanned exactly
// [y(t0), y(t1)], so it never saw that holding the rows' x at s=0/s=1 while
// moving them in y shears the quad off the ribbon. A `Geometry` now carries the
// rows it emits alongside its pad, and `shearedStraightRows` keeps the old
// spelling as a counterexample.
//
// One thing this deliberately does NOT check, and cannot: which corner pairs with
// which to form an edge. `edgesAt` below is the model of BOTH the polygon and the
// analytic clip, so a shader where those two disagreed would still pass here. The
// shader single-sources that pairing in `ribbonEdges` instead — the polygon
// (edgeSpan), the clip (fillEdges), the slope pads (ribbonEdgeDeltas) and the
// sub-pixel allowance (ribbonWidths) are all derived from that one function.

// This file imports nothing on purpose — it is a model of the shader, not a
// consumer of it — which without this line leaves `sBlend` and friends in the
// GLOBAL scope, where tsc collides them with any sibling that mirrors the same
// shader under the same names. `probe-synteny-thin-fade.ts` is one.
export {}

const NUM_SEGMENTS = 8
const invN = 1 / NUM_SEGMENTS

const sBlend = (t: number) => t * t * (3 - 2 * t)
const sBlendDeriv = (t: number) => 6 * t * (1 - t)
const yCurve = (t: number) => 1.5 * t * (1 - t) + t * t * t
const yCurveDeriv = (t: number) => 1.5 - 3 * t + 3 * t * t

interface Corners {
  x1: number
  x2: number
  x3: number
  x4: number
}

// fillEdges: each edge's x at parameter t plus its OWN slope foreshortening.
// `sd`/`dydt` are the mode's analytic derivatives (straight: 1 and h; curve:
// sBlendDeriv(t) and h*yCurveDeriv(t)).
function edgesAt(c: Corners, h: number, t: number, curve: boolean) {
  const s = curve ? sBlend(t) : t
  const sd = curve ? sBlendDeriv(t) : 1
  const dydt = curve ? h * yCurveDeriv(t) : h
  const e0 = c.x1 + (c.x4 - c.x1) * s
  const e1 = c.x2 + (c.x3 - c.x2) * s
  const pf0 = Math.hypot(1, ((c.x4 - c.x1) * sd) / Math.abs(dydt))
  const pf1 = Math.hypot(1, ((c.x3 - c.x2) * sd) / Math.abs(dydt))
  return { e0, e1, pf0, pf1 }
}

// perpCoverage: the outermost x on each side where coverage is still non-zero.
// dL = (x - xL)/pfL + expand must exceed -aaHalf, so the footprint reaches
// pfL*(aaHalf + expand) past the edge.
//
// aaHalf is 0.5/dpr CSS px (aaHalfPx), so dpr=1 gives the largest footprint and
// is the case the geometry has to cover — that is why 0.5 is hard-coded here
// rather than parameterised. Same for STROKE_PERP_PX below.
function footprint(c: Corners, h: number, t: number, curve: boolean) {
  const { e0, e1, pf0, pf1 } = edgesAt(c, h, t, curve)
  const xL = Math.min(e0, e1)
  const xR = Math.max(e0, e1)
  const pfL = e0 <= e1 ? pf0 : pf1
  const pfR = e0 <= e1 ? pf1 : pf0
  const perpW = (xR - xL) / (0.5 * (pfL + pfR))
  const expand = Math.max(0.5 - 0.5 * perpW, 0)
  return { left: xL - pfL * (0.5 + expand), right: xR + pfR * (0.5 + expand) }
}

// thinRibbonPad: allowance for perpCoverage's sub-pixel `expand`, bounded by the
// ribbon's minimum horizontal width over the X-blend range the calling quad
// spans (the shader takes the two ends from `ribbonWidths`). edge1 - edge0 =
// lerp(x2-x1, x3-x4, s) in both modes, so the width only reaches zero between
// them on a sign change.
function padExtra(perpFactor: number, c: Corners, s0: number, s1: number) {
  const dTop = c.x2 - c.x1
  const dBot = c.x3 - c.x4
  const wA = dTop + (dBot - dTop) * s0
  const wB = dTop + (dBot - dTop) * s1
  const wMin = wA * wB < 0 ? 0 : Math.min(Math.abs(wA), Math.abs(wB))
  return Math.max(perpFactor * 0.5 - 0.5 * wMin, 0)
}

// PAD_SLACK_PX: float32 headroom, not an AA term — see the shader.
const SLACK = 0.25

function straightPerpFactor(c: Corners, h: number) {
  return Math.hypot(
    1,
    Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2)) / h,
  )
}

function curvePerpFactor(c: Corners, h: number, seg: number) {
  const t0 = seg * invN
  const t1 = (seg + 1) * invN
  const maxEdgeDx = Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2))
  // dx/dy peaks at 2x the chord slope at t=0.5 and is unimodal, so the max over
  // the segment is at whichever in-range t sits closest to 0.5.
  const tPeak = Math.min(Math.max(0.5, t0), t1)
  return Math.hypot(
    1,
    (maxEdgeDx / h) * (sBlendDeriv(tPeak) / yCurveDeriv(tPeak)),
  )
}

const bulgeX = (c: Corners) =>
  Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2)) * invN * invN * 0.75

// `extraPerpPx` mirrors the geometry functions' parameter: 0 for the fill
// passes, STROKE_PERP_PX for the clicked-outline passes, whose stroke ramp
// reaches STROKE_HALF_PX + aaHalf = 1 CSS px outside each edge at dpr=1.
const STROKE_PERP_PX = 1

// The two rows one emitted quad is built from: their screen y, and the X-blend
// the vertex shader takes their x from. This is the part the model used to
// assume rather than state, and the part that was wrong.
//
// A quad's sides run straight between its rows, so x interpolates linearly in
// SCREEN Y — which only tracks the ribbon if the two rows' blends are the ones
// belonging to their own y. straightGeometry extrapolates for exactly that
// reason (s = -1/h and 1 + 1/h at the ±1px AA rows). curveGeometry does not, and
// the sweeps below are what says it does not have to: its end segments sit where
// the x-curve is momentarily vertical.
interface Rows {
  yLo: number
  yHi: number
  sLo: number
  sHi: number
}

const straightRows = (h: number): Rows => ({
  yLo: -1,
  yHi: h + 1,
  sLo: -1 / h,
  sHi: 1 + 1 / h,
})

// What straightGeometry emitted before: the AA rows moved in y but kept the
// blend of the ribbon's ends, which shears the quad across the ribbon's travel.
const shearedStraightRows = (h: number): Rows => ({
  yLo: -1,
  yHi: h + 1,
  sLo: 0,
  sHi: 1,
})

const curveRows = (h: number, seg: number): Rows => {
  const t0 = seg * invN
  const t1 = (seg + 1) * invN
  return {
    yLo: h * yCurve(t0) - (seg === 0 ? 1 : 0),
    yHi: h * yCurve(t1) + (seg === NUM_SEGMENTS - 1 ? 1 : 0),
    sLo: sBlend(t0),
    sHi: sBlend(t1),
  }
}

type RowsFn = (c: Corners, h: number, seg: number) => Rows

// A whole geometry function: which rows it emits and how far it pads them.
interface Geometry {
  curve: boolean
  rows: RowsFn
  pad: (c: Corners, h: number, seg: number, rows: Rows) => number
}

const straightGeometry = (extraPerpPx = 0, rows = straightRows): Geometry => ({
  curve: false,
  rows: (_c, h) => rows(h),
  pad: (c, h, _seg, r) => {
    const pf = straightPerpFactor(c, h)
    return pf * (0.5 + extraPerpPx) + padExtra(pf, c, r.sLo, r.sHi) + SLACK
  },
})

const curveGeometry = (extraPerpPx = 0): Geometry => ({
  curve: true,
  rows: (_c, h, seg) => curveRows(h, seg),
  pad: (c, h, seg, r) => {
    const pf = curvePerpFactor(c, h, seg)
    return (
      pf * (0.5 + extraPerpPx) +
      padExtra(pf, c, r.sLo, r.sHi) +
      bulgeX(c) +
      SLACK
    )
  },
})

// What the polygon has to contain. The fill needs perpCoverage's footprint; the
// outline needs the ±STROKE_PERP_PX band strokeFs ramps across, on both edges.
type FootprintFn = (
  c: Corners,
  h: number,
  t: number,
  curve: boolean,
) => { left: number; right: number }

const strokeFootprint: FootprintFn = (c, h, t, curve) => {
  const { e0, e1, pf0, pf1 } = edgesAt(c, h, t, curve)
  const pfL = e0 <= e1 ? pf0 : pf1
  const pfR = e0 <= e1 ? pf1 : pf0
  return {
    left: Math.min(e0, e1) - pfL * STROKE_PERP_PX,
    right: Math.max(e0, e1) + pfR * STROKE_PERP_PX,
  }
}

// The bezier parameter the curve fragment recovers from a row's y
// (curveParamAtY, which clamps). Bisection rather than the shader's two Newton
// steps: the question here is what the geometry has to contain, not how
// accurately the fragment inverts.
function curveParamAtY(yLocal: number, h: number) {
  const yFrac = Math.min(Math.max(yLocal / h, 0), 1)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (yCurve(m) < yFrac) {
      lo = m
    } else {
      hi = m
    }
  }
  return (lo + hi) / 2
}

// edgeSpan: the row's left/right x at an X-blend, taken straight rather than
// through `edgesAt`, which parameterises on the bezier t.
function spanAtBlend(c: Corners, s: number) {
  const e0 = c.x1 + (c.x4 - c.x1) * s
  const e1 = c.x2 + (c.x3 - c.x2) * s
  return { l: Math.min(e0, e1), r: Math.max(e0, e1) }
}

// Rows sampled per segment. A crop is continuous in y — a pad that is short is
// short over a range of rows, not at one — so the sweeps below find it at 100
// as well as at the 400 this used to take, and the file ran 52s of the suite's
// wall clock at 400. The nine named shapes and the sabotage arms are what pin
// the individual geometries; the sweeps are for corner configurations, which is
// why the sweep COUNT stayed at 4000.
const SAMPLES = 100

// Worst px the padded geometry crops away, over every segment and SAMPLES rows
// within each. Zero means the polygon contains the whole footprint.
function worstCrop(
  c: Corners,
  height: number,
  geom: Geometry,
  footprintFn: FootprintFn = footprint,
) {
  const h = Math.max(height, 1)
  const { curve } = geom
  let worst = 0
  for (let seg = 0; seg < (curve ? NUM_SEGMENTS : 1); seg++) {
    const r = geom.rows(c, h, seg)
    const pad = geom.pad(c, h, seg, r)
    const lo = spanAtBlend(c, r.sLo)
    const hi = spanAtBlend(c, r.sHi)
    for (let k = 0; k <= SAMPLES; k++) {
      const y = r.yLo + (r.yHi - r.yLo) * (k / SAMPLES)
      // The straight fragment reads t straight off y and does NOT clamp, so its
      // edges continue past both ends; the curve fragment clamps, so its end
      // rows measure against the frozen t=0 / t=1 edges.
      const t = curve ? curveParamAtY(y, h) : y / h
      const f = (y - r.yLo) / (r.yHi - r.yLo)
      const fp = footprintFn(c, h, t, curve)
      worst = Math.max(
        worst,
        lo.l - pad + (hi.l - lo.l) * f - fp.left,
        fp.right - (lo.r + pad + (hi.r - lo.r) * f),
      )
    }
  }
  return worst
}

const cropStraight = (c: Corners, h: number, geom = straightGeometry()) =>
  worstCrop(c, h, geom)
const cropCurve = (c: Corners, h: number, geom = curveGeometry()) =>
  worstCrop(c, h, geom)

const shapes: [string, Corners, number][] = [
  ['vertical parallelogram', { x1: 100, x2: 200, x3: 200, x4: 100 }, 100],
  ['steep parallelogram', { x1: 100, x2: 200, x3: 1000, x4: 900 }, 100],
  ['very steep, short track', { x1: 0, x2: 50, x3: 3000, x4: 2950 }, 20],
  ['width-changing', { x1: 100, x2: 900, x3: 1200, x4: 1180 }, 100],
  ['concave neck', { x1: 0, x2: 1000, x3: 600, x4: 590 }, 200],
  ['crossed (bowtie)', { x1: 100, x2: 200, x3: 100, x4: 200 }, 100],
  ['crossed and steep', { x1: 0, x2: 800, x3: 100, x4: 1500 }, 100],
  ['sub-pixel thin, steep', { x1: 100, x2: 100.3, x3: 2000, x4: 2000.3 }, 100],
  ['tall track', { x1: 0, x2: 300, x3: 1400, x4: 1500 }, 400],
]

// Deterministic LCG — a fixed sweep, not a flaky random one.
function sweep(n: number) {
  let seed = 7
  const rnd = () =>
    (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const out: [Corners, number][] = []
  for (let i = 0; i < n; i++) {
    out.push([
      {
        x1: rnd() * 4000 - 2000,
        x2: rnd() * 4000 - 2000,
        x3: rnd() * 4000 - 2000,
        x4: rnd() * 4000 - 2000,
      },
      5 + rnd() * 500,
    ])
  }
  return out
}

describe('straight-fill vertex pad', () => {
  test.each(shapes)('contains the whole coverage footprint: %s', (_n, c, h) => {
    expect(cropStraight(c, h)).toBe(0)
  })

  test('holds across a randomized sweep of ribbon geometries', () => {
    let worst = 0
    for (const [c, h] of sweep(4000)) {
      worst = Math.max(worst, cropStraight(c, h))
    }
    expect(worst).toBe(0)
  })

  test('a centerline-average slope would crop the AA ramp (do not reintroduce)', () => {
    // What this pad used to be. The average under-pads whichever edge travels
    // further, so a width-changing ribbon loses the outer part of its ramp on
    // the steeper side — the same reasoning that put maxEdgeDx in the curve pad.
    const centerline: Geometry = {
      ...straightGeometry(),
      pad: (c, h, _seg, r) => {
        const pf = Math.hypot(
          1,
          Math.abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h,
        )
        return pf * 0.5 + padExtra(pf, c, r.sLo, r.sHi) + SLACK
      },
    }
    const c = { x1: 100, x2: 900, x3: 1200, x4: 1180 }
    expect(cropStraight(c, 100, centerline)).toBeGreaterThan(0.9)
    expect(cropStraight(c, 100)).toBe(0)
  })

  test('the AA rows take their x from their own y (do not reintroduce)', () => {
    // The quad's two rows sit a pixel outside the ribbon so vertCoverage can
    // ramp. Leaving their blend at s=0/s=1 while moving them in y — which is
    // what this shader did — makes the sides run over height+2 px of y while the
    // ribbon runs over height, so they lean across its travel and cut the
    // outside of the coverage footprint away.
    //
    // The crop is a fixed fraction of the slope, so it barely shows on a gentle
    // ribbon and takes the entire footprint on a steep one — including, on a
    // sub-pixel ribbon, the 1px minimum band that is the only thing drawing it
    // at whole-genome zoom.
    const sheared = (extraPerpPx = 0) =>
      straightGeometry(extraPerpPx, shearedStraightRows)
    // In horizontal px, as everything here is. This ribbon's perpFactor is
    // 19.03, so the 18.6 below is 0.98 PERPENDICULAR px — the footprint reaches
    // 0.5 + expand ≤ 1.0, so effectively all of it.
    const gentle = { x1: 100, x2: 200, x3: 260, x4: 160 }
    expect(cropStraight(gentle, 100, sheared())).toBeLessThan(0.5)
    const steep = { x1: 100, x2: 100.3, x3: 2000, x4: 2000.3 }
    expect(cropStraight(steep, 100, sheared())).toBeGreaterThan(18)
    expect(cropStraight(steep, 100)).toBe(0)
    // and the outline pass rides the same polygon, so it lost its stroke too —
    // on a wider ribbon, since STROKE_PERP_PX buys the thin one's stroke a
    // second perpFactor of pad that happens to absorb the lean.
    const short = { x1: 0, x2: 50, x3: 3000, x4: 2950 }
    expect(
      worstCrop(short, 20, sheared(STROKE_PERP_PX), strokeFootprint),
    ).toBeGreaterThan(24)
    expect(
      worstCrop(short, 20, straightGeometry(STROKE_PERP_PX), strokeFootprint),
    ).toBe(0)
  })

  test('holds when the ribbon is barely taller than its AA rows', () => {
    // height is floored at 1 by writeUniforms, so the extrapolated blend can
    // reach s = -1 and s = 2 — a range wider than the ribbon itself, which is
    // where thinRibbonPad reading the whole ribbon's width would under-pad.
    let worst = 0
    for (const [c] of sweep(600)) {
      for (const h of [1, 1.5, 2, 3, 5]) {
        worst = Math.max(worst, cropStraight(c, h))
      }
    }
    expect(worst).toBe(0)
  })
})

describe('curve-fill vertex pad', () => {
  test.each(shapes)('contains the whole coverage footprint: %s', (_n, c, h) => {
    expect(cropCurve(c, h)).toBe(0)
  })

  test('holds across a randomized sweep of ribbon geometries', () => {
    let worst = 0
    for (const [c, h] of sweep(4000)) {
      worst = Math.max(worst, cropCurve(c, h))
    }
    expect(worst).toBe(0)
  })

  test('a per-segment bulge term would crop the curve (do not reintroduce)', () => {
    // |s''(t)| = |6-12t| is 0 at t=0.5, so scaling the bulge by it looks like
    // free savings for the middle segments. It is not: that bounds deviation
    // from the chord in t, while the quad interpolates in screen y. This pins
    // the counterexample named in the shader comment.
    //
    // Both sides drop thinRibbonPad, which on this bowtie contributes ~3.8px and
    // would otherwise absorb the 0.27px deficit and hide the point.
    const maxEdgeDx = (c: Corners) =>
      Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2))
    const ribbonWideBulge: Geometry = {
      ...curveGeometry(),
      pad: (c, h, seg) => curvePerpFactor(c, h, seg) * 0.5 + bulgeX(c) + 1,
    }
    const perSegmentBulge: Geometry = {
      ...curveGeometry(),
      pad: (c, h, seg) => {
        const maxCurvature = Math.max(
          Math.abs(6 - 12 * seg * invN),
          Math.abs(6 - 12 * (seg + 1) * invN),
        )
        return (
          curvePerpFactor(c, h, seg) * 0.5 +
          maxEdgeDx(c) * maxCurvature * invN * invN * 0.125 +
          1
        )
      },
    }
    const c = { x1: 0, x2: 300, x3: 1400, x4: 1500 }
    expect(cropCurve(c, 400, perSegmentBulge)).toBeGreaterThan(0)
    expect(cropCurve(c, 400, ribbonWideBulge)).toBe(0)
    expect(cropCurve(c, 400)).toBe(0)
  })

  test('term (1) stays per-segment rather than ribbon-wide', () => {
    // The saving the per-segment bound exists for. On a parallelogram both edges
    // share the same Δ, so the max-edge basis is a no-op and the only difference
    // is term (1) being evaluated per segment: local dx/dy peaks at 2x the chord
    // slope near t=0.5 and falls to 0 at the ends. Edge 0 runs x1→x4 and edge 1
    // runs x2→x3, so parallel means x4-x1 === x3-x2.
    const parallelograms: [Corners, number][] = [
      [{ x1: 100, x2: 200, x3: 1000, x4: 900 }, 100],
      [{ x1: 0, x2: 50, x3: 3000, x4: 2950 }, 20],
      [{ x1: 100, x2: 100.3, x3: 2000.3, x4: 2000 }, 100],
    ]
    const ribbonWidePad = (c: Corners, height: number) => {
      const maxEdgeDx = Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2))
      const pf = Math.hypot(1, (maxEdgeDx / height) * 2)
      return pf * 0.5 + padExtra(pf, c, 0, 1) + bulgeX(c) + SLACK
    }
    for (const [c] of parallelograms) {
      expect(c.x4 - c.x1).toBeCloseTo(c.x3 - c.x2)
    }
    const curve = curveGeometry()
    for (const [c, h] of parallelograms) {
      const wide = ribbonWidePad(c, h)
      const padAt = (seg: number) => curve.pad(c, h, seg, curve.rows(c, h, seg))
      for (let seg = 0; seg < NUM_SEGMENTS; seg++) {
        expect(padAt(seg)).toBeLessThanOrEqual(wide)
      }
      // and the end segments, where the x-curve is near-vertical, save the most
      expect(padAt(0)).toBeLessThan(wide)
      expect(padAt(NUM_SEGMENTS - 1)).toBeLessThan(wide)
    }
  })
})

describe('clicked-outline geometry', () => {
  // The outline passes draw the fill's polygon widened by STROKE_PERP_PX and
  // clip analytically, so the outline traces the fill by construction. That only
  // holds if the widened polygon contains the whole ±STROKE_PERP_PX band —
  // otherwise the stroke's outer half is cropped and the hairline thins.
  test.each(shapes)(
    'contains the full stroke band (straight): %s',
    (_n, c, h) => {
      expect(
        worstCrop(c, h, straightGeometry(STROKE_PERP_PX), strokeFootprint),
      ).toBe(0)
    },
  )

  test.each(shapes)('contains the full stroke band (curve): %s', (_n, c, h) => {
    expect(
      worstCrop(c, h, curveGeometry(STROKE_PERP_PX), strokeFootprint),
    ).toBe(0)
  })

  test('holds across a randomized sweep', () => {
    let ws = 0
    let wc = 0
    for (const [c, h] of sweep(4000)) {
      ws = Math.max(
        ws,
        worstCrop(c, h, straightGeometry(STROKE_PERP_PX), strokeFootprint),
      )
      wc = Math.max(
        wc,
        worstCrop(c, h, curveGeometry(STROKE_PERP_PX), strokeFootprint),
      )
    }
    expect(ws).toBe(0)
    expect(wc).toBe(0)
  })

  test('the fill pad alone would crop the stroke (why extraPerpPx exists)', () => {
    // The fill pad guarantees only ~0.5 perpendicular px outside each edge, so
    // reusing it unwidened for the outline eats the stroke's outer half on a
    // slanted ribbon. Curve mode crops less on the same corners only because
    // its bulge term happens to pad in the same direction — still not enough.
    const c = { x1: 100, x2: 200, x3: 1000, x4: 900 }
    expect(
      worstCrop(c, 100, straightGeometry(), strokeFootprint),
    ).toBeGreaterThan(2)
    expect(worstCrop(c, 100, curveGeometry(), strokeFootprint)).toBeGreaterThan(
      0,
    )
  })
})

describe('thinRibbonPad', () => {
  test('costs a comfortably wide ribbon nothing', () => {
    // The allowance is bounded by the ribbon's own width, so anything wider than
    // perpFactor px gets no extra pad and the per-segment saving is untouched.
    expect(padExtra(1, { x1: 100, x2: 900, x3: 900, x4: 100 }, 0, 1)).toBe(0)
    expect(padExtra(10.05, { x1: 0, x2: 400, x3: 1400, x4: 1000 }, 0, 1)).toBe(
      0,
    )
  })

  test('without it, a steep thin ribbon loses its 1px minimum band', () => {
    // perpCoverage pushes both edges out by up to 0.5 perpendicular px to hold a
    // sub-pixel ribbon at a locatable 1px. Padding only for the AA ramp crops
    // exactly that band — the failure this allowance exists to prevent.
    const noExtraStraight: Geometry = {
      ...straightGeometry(),
      pad: (c, h) => straightPerpFactor(c, h) * 0.5 + 1,
    }
    const noExtraCurve: Geometry = {
      ...curveGeometry(),
      pad: (c, h, seg) => curvePerpFactor(c, h, seg) * 0.5 + bulgeX(c) + 1,
    }
    const thin = { x1: 100, x2: 100.3, x3: 2000, x4: 2000.3 }
    expect(cropStraight(thin, 100, noExtraStraight)).toBeGreaterThan(8)
    expect(cropCurve(thin, 100, noExtraCurve)).toBeGreaterThan(3)
    expect(cropStraight(thin, 100)).toBe(0)
    expect(cropCurve(thin, 100)).toBe(0)
  })
})
