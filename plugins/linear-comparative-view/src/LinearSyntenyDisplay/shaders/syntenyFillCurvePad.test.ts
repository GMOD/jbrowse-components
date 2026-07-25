// The curve-fill vertex shader wraps each of its 8 bezier segments in a padded
// trapezoid and clips to the true analytic curve in the fragment. If the pad is
// ever too small the geometry crops the curve's antialiased edge — ribbons render
// visibly thinner, with hard-cut sides. Nothing else can catch that: the shader
// isn't unit-testable and no browser suite exercises curve mode.
//
// So this mirrors the pad math from syntenyFillCurve.slang's vs_main plus the
// ribbon basis from syntenyTypes.slang, and asserts the invariant the shader
// relies on: at every y, the padded trapezoid extends at least the 1px AA margin
// beyond the analytic edge on both sides.
// SYNC: keep in step with the `pad` block in syntenyFillCurve.slang.

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

// The two ribbon edges at parameter t, ordered left/right (they swap on a
// crossed "bowtie" ribbon, which is why the shader takes min/max rather than
// assuming an order).
function edgesAt(c: Corners, t: number) {
  const s = sBlend(t)
  const e0 = c.x1 + (c.x4 - c.x1) * s
  const e1 = c.x2 + (c.x3 - c.x2) * s
  return { xL: Math.min(e0, e1), xR: Math.max(e0, e1) }
}

function segmentPad(c: Corners, height: number, seg: number) {
  const h = Math.max(height, 1)
  const t0 = seg * invN
  const t1 = (seg + 1) * invN
  const maxEdgeDx = Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2))
  const tPeak = Math.min(Math.max(0.5, t0), t1)
  const segSlope = (maxEdgeDx / h) * (sBlendDeriv(tPeak) / yCurveDeriv(tPeak))
  const perpFactor = Math.sqrt(1 + segSlope * segSlope)
  const bulgeX = maxEdgeDx * invN * invN * 0.75
  return perpFactor * 0.5 + bulgeX + 1
}

// The ribbon-wide pad the shader used before term (1) became per-segment. Kept
// so the tests can show the change never pads less than the AA margin needs and
// can quantify what it saves.
function legacyPad(c: Corners, height: number) {
  const h = Math.max(height, 1)
  const maxSlope = (Math.abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h) * 2
  const bulgeX =
    Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2)) * invN * invN * 0.75
  return Math.sqrt(1 + maxSlope * maxSlope) * 0.5 + bulgeX + 1
}

// Smallest gap (px) between the padded trapezoid boundary and the analytic edge
// plus its 1px AA margin, over every segment and 400 samples within each.
// Negative means the geometry crops coverage the fragment would have drawn.
function worstAaMargin(
  padFn: (c: Corners, height: number, seg: number) => number,
  c: Corners,
  height: number,
) {
  const h = Math.max(height, 1)
  let worst = Infinity
  for (let seg = 0; seg < NUM_SEGMENTS; seg++) {
    const t0 = seg * invN
    const t1 = (seg + 1) * invN
    const pad = padFn(c, height, seg)
    const e0 = edgesAt(c, t0)
    const e1 = edgesAt(c, t1)
    const y0 = h * yCurve(t0)
    const y1 = h * yCurve(t1)
    for (let k = 0; k <= 400; k++) {
      const t = t0 + (t1 - t0) * (k / 400)
      // The quad's rows sit at y(t0)/y(t1) and its sides are straight lines
      // between them, so x interpolates linearly in SCREEN Y — not in t.
      const f = (h * yCurve(t) - y0) / (y1 - y0)
      const left = e0.xL - pad + (e1.xL - (e0.xL - pad) - pad) * f
      const right = e0.xR + pad + (e1.xR + pad - (e0.xR + pad)) * f
      const { xL, xR } = edgesAt(c, t)
      worst = Math.min(worst, xL - 1 - left, right - (xR + 1))
    }
  }
  return worst
}

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

describe('curve-fill vertex pad', () => {
  test.each(shapes)('keeps the AA margin around the curve: %s', (_n, c, h) => {
    expect(worstAaMargin(segmentPad, c, h)).toBeGreaterThanOrEqual(0)
  })

  test('holds across a randomized sweep of ribbon geometries', () => {
    // Deterministic LCG — a fixed sweep, not a flaky random one.
    let seed = 7
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    let worst = Infinity
    for (let i = 0; i < 4000; i++) {
      const height = 5 + rnd() * 500
      const c = {
        x1: rnd() * 4000 - 2000,
        x2: rnd() * 4000 - 2000,
        x3: rnd() * 4000 - 2000,
        x4: rnd() * 4000 - 2000,
      }
      worst = Math.min(worst, worstAaMargin(segmentPad, c, height))
    }
    expect(worst).toBeGreaterThanOrEqual(0)
  })

  test('pads strictly less than the ribbon-wide bound on parallelograms', () => {
    // The saving this change exists for. On a parallelogram both edges share the
    // same Δ, so switching the slope basis from the centerline to the wider edge
    // is a no-op and the only difference is term (1) being per-segment. Edge 0
    // runs x1→x4 and edge 1 runs x2→x3, so parallel means x4-x1 === x3-x2.
    const parallelograms: [Corners, number][] = [
      [{ x1: 100, x2: 200, x3: 1000, x4: 900 }, 100],
      [{ x1: 0, x2: 50, x3: 3000, x4: 2950 }, 20],
      [{ x1: 100, x2: 100.3, x3: 2000.3, x4: 2000 }, 100],
    ]
    for (const [c] of parallelograms) {
      expect(c.x4 - c.x1).toBeCloseTo(c.x3 - c.x2)
    }
    for (const [c, h] of parallelograms) {
      const legacy = legacyPad(c, h)
      for (let seg = 0; seg < NUM_SEGMENTS; seg++) {
        expect(segmentPad(c, h, seg)).toBeLessThanOrEqual(legacy)
      }
      // and the end segments, where the x-curve is near-vertical, save the most
      expect(segmentPad(c, h, 0)).toBeLessThan(legacy)
      expect(segmentPad(c, h, NUM_SEGMENTS - 1)).toBeLessThan(legacy)
    }
  })

  test('pads MORE than the ribbon-wide bound on a width-changing ribbon', () => {
    // Deliberate: the pad protects each edge, and the legacy centerline average
    // under-covers whichever edge travels further. Documented here so the
    // asymmetry reads as intentional rather than as a regression.
    const c = { x1: 100, x2: 900, x3: 1200, x4: 1180 }
    expect(segmentPad(c, 100, 4)).toBeGreaterThan(legacyPad(c, 100))
  })

  test('a per-segment bulge term would crop the curve (do not reintroduce)', () => {
    // |s''(t)| = |6-12t| is 0 at t=0.5, so scaling the bulge by it looks like
    // free savings for the middle segments. It is not: that bounds deviation
    // from the chord in t, while the quad interpolates in screen y. This pins
    // the counterexample named in the shader comment.
    const perSegmentBulgePad = (c: Corners, height: number, seg: number) => {
      const h = Math.max(height, 1)
      const t0 = seg * invN
      const t1 = (seg + 1) * invN
      const maxEdgeDx = Math.max(Math.abs(c.x4 - c.x1), Math.abs(c.x3 - c.x2))
      const tPeak = Math.min(Math.max(0.5, t0), t1)
      const segSlope =
        (maxEdgeDx / h) * (sBlendDeriv(tPeak) / yCurveDeriv(tPeak))
      const maxCurvature = Math.max(
        Math.abs(6 - 12 * t0),
        Math.abs(6 - 12 * t1),
      )
      const bulgeX = maxEdgeDx * maxCurvature * invN * invN * 0.125
      return Math.sqrt(1 + segSlope * segSlope) * 0.5 + bulgeX + 1
    }
    const c = { x1: 0, x2: 300, x3: 1400, x4: 1500 }
    expect(worstAaMargin(perSegmentBulgePad, c, 400)).toBeLessThan(0)
    expect(worstAaMargin(segmentPad, c, 400)).toBeGreaterThanOrEqual(0)
  })
})
