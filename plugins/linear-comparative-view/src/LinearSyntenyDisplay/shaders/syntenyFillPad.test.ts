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
// One thing this deliberately does NOT check, and cannot: which corner pairs with
// which to form an edge. `edgesAt` below is the model of BOTH the polygon and the
// analytic clip, so a shader where those two disagreed would still pass here. The
// shader single-sources that pairing in `ribbonEdges` instead — the polygon
// (edgeSpan), the clip (fillEdges), the slope pads (ribbonEdgeDeltas) and the
// sub-pixel allowance (ribbonWidths) are all derived from that one function.

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

type PadFn = (c: Corners, height: number, seg: number) => number

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
// ribbon's minimum horizontal width (the shader takes the two ends from
// `ribbonWidths`). edge1 - edge0 = lerp(x2-x1, x3-x4, s) in both modes, so the
// width only reaches zero mid-ribbon on a sign change.
function padExtra(perpFactor: number, c: Corners) {
  const dTop = c.x2 - c.x1
  const dBot = c.x3 - c.x4
  const wMin = dTop * dBot < 0 ? 0 : Math.min(Math.abs(dTop), Math.abs(dBot))
  return Math.max(perpFactor * 0.5 - 0.5 * wMin, 0)
}

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

const straightPad =
  (extraPerpPx = 0): PadFn =>
  (c, height) => {
    const pf = straightPerpFactor(c, Math.max(height, 1))
    return pf * (0.5 + extraPerpPx) + padExtra(pf, c) + 1
  }

const curvePad =
  (extraPerpPx = 0): PadFn =>
  (c, height, seg) => {
    const pf = curvePerpFactor(c, Math.max(height, 1), seg)
    return pf * (0.5 + extraPerpPx) + padExtra(pf, c) + bulgeX(c) + 1
  }

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

const SAMPLES = 400

// Worst px the padded geometry crops away, over every segment and SAMPLES rows
// within each. Zero means the polygon contains the whole footprint.
function worstCrop(
  c: Corners,
  height: number,
  curve: boolean,
  padFn: PadFn,
  footprintFn: FootprintFn = footprint,
) {
  const h = Math.max(height, 1)
  let worst = 0
  for (let seg = 0; seg < (curve ? NUM_SEGMENTS : 1); seg++) {
    const t0 = curve ? seg * invN : 0
    const t1 = curve ? (seg + 1) * invN : 1
    const yAt = (t: number) => (curve ? h * yCurve(t) : h * t)
    const pad = padFn(c, height, seg)
    const a = edgesAt(c, h, t0, curve)
    const b = edgesAt(c, h, t1, curve)
    const aL = Math.min(a.e0, a.e1)
    const aR = Math.max(a.e0, a.e1)
    const bL = Math.min(b.e0, b.e1)
    const bR = Math.max(b.e0, b.e1)
    for (let k = 0; k <= SAMPLES; k++) {
      const t = t0 + (t1 - t0) * (k / SAMPLES)
      // The quad's rows sit at y(t0)/y(t1) and its sides are straight lines
      // between them, so x interpolates linearly in SCREEN Y — not in t.
      const f = (yAt(t) - yAt(t0)) / (yAt(t1) - yAt(t0))
      const fp = footprintFn(c, h, t, curve)
      worst = Math.max(
        worst,
        aL - pad + (bL - aL) * f - fp.left,
        fp.right - (aR + pad + (bR - aR) * f),
      )
    }
  }
  return worst
}

const cropStraight = (c: Corners, h: number, padFn = straightPad()) =>
  worstCrop(c, h, false, padFn)
const cropCurve = (c: Corners, h: number, padFn = curvePad()) =>
  worstCrop(c, h, true, padFn)

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
    const centerlinePad: PadFn = (c, height) => {
      const pf = Math.hypot(
        1,
        Math.abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / Math.max(height, 1),
      )
      return pf * 0.5 + padExtra(pf, c) + 1
    }
    const c = { x1: 100, x2: 900, x3: 1200, x4: 1180 }
    expect(cropStraight(c, 100, centerlinePad)).toBeGreaterThan(0.9)
    expect(cropStraight(c, 100)).toBe(0)
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
    const ribbonWideBulge: PadFn = (c, height, seg) =>
      curvePerpFactor(c, Math.max(height, 1), seg) * 0.5 + bulgeX(c) + 1
    const perSegmentBulge: PadFn = (c, height, seg) => {
      const maxCurvature = Math.max(
        Math.abs(6 - 12 * seg * invN),
        Math.abs(6 - 12 * (seg + 1) * invN),
      )
      return (
        curvePerpFactor(c, Math.max(height, 1), seg) * 0.5 +
        maxEdgeDx(c) * maxCurvature * invN * invN * 0.125 +
        1
      )
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
      const pf = Math.hypot(1, (maxEdgeDx / Math.max(height, 1)) * 2)
      return pf * 0.5 + padExtra(pf, c) + bulgeX(c) + 1
    }
    for (const [c] of parallelograms) {
      expect(c.x4 - c.x1).toBeCloseTo(c.x3 - c.x2)
    }
    for (const [c, h] of parallelograms) {
      const wide = ribbonWidePad(c, h)
      for (let seg = 0; seg < NUM_SEGMENTS; seg++) {
        expect(curvePad()(c, h, seg)).toBeLessThanOrEqual(wide)
      }
      // and the end segments, where the x-curve is near-vertical, save the most
      expect(curvePad()(c, h, 0)).toBeLessThan(wide)
      expect(curvePad()(c, h, NUM_SEGMENTS - 1)).toBeLessThan(wide)
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
        worstCrop(c, h, false, straightPad(STROKE_PERP_PX), strokeFootprint),
      ).toBe(0)
    },
  )

  test.each(shapes)('contains the full stroke band (curve): %s', (_n, c, h) => {
    expect(
      worstCrop(c, h, true, curvePad(STROKE_PERP_PX), strokeFootprint),
    ).toBe(0)
  })

  test('holds across a randomized sweep', () => {
    let ws = 0
    let wc = 0
    for (const [c, h] of sweep(4000)) {
      ws = Math.max(
        ws,
        worstCrop(c, h, false, straightPad(STROKE_PERP_PX), strokeFootprint),
      )
      wc = Math.max(
        wc,
        worstCrop(c, h, true, curvePad(STROKE_PERP_PX), strokeFootprint),
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
      worstCrop(c, 100, false, straightPad(), strokeFootprint),
    ).toBeGreaterThan(2)
    expect(
      worstCrop(c, 100, true, curvePad(), strokeFootprint),
    ).toBeGreaterThan(0)
  })
})

describe('thinRibbonPad', () => {
  test('costs a comfortably wide ribbon nothing', () => {
    // The allowance is bounded by the ribbon's own width, so anything wider than
    // perpFactor px gets no extra pad and the per-segment saving is untouched.
    expect(padExtra(1, { x1: 100, x2: 900, x3: 900, x4: 100 })).toBe(0)
    expect(padExtra(10.05, { x1: 0, x2: 400, x3: 1400, x4: 1000 })).toBe(0)
  })

  test('without it, a steep thin ribbon loses its 1px minimum band', () => {
    // perpCoverage pushes both edges out by up to 0.5 perpendicular px to hold a
    // sub-pixel ribbon at a locatable 1px. Padding only for the AA ramp crops
    // exactly that band — the failure this allowance exists to prevent.
    const noExtraStraight: PadFn = (c, height) =>
      straightPerpFactor(c, Math.max(height, 1)) * 0.5 + 1
    const noExtraCurve: PadFn = (c, height, seg) =>
      curvePerpFactor(c, Math.max(height, 1), seg) * 0.5 + bulgeX(c) + 1
    const thin = { x1: 100, x2: 100.3, x3: 2000, x4: 2000.3 }
    expect(cropStraight(thin, 100, noExtraStraight)).toBeGreaterThan(8)
    expect(cropCurve(thin, 100, noExtraCurve)).toBeGreaterThan(3)
    expect(cropStraight(thin, 100)).toBe(0)
    expect(cropCurve(thin, 100)).toBe(0)
  })
})
