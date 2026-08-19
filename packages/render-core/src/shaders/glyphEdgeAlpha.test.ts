// `glyphEdgeAlpha` (antialias.slang) sizes the antialiasing ramp on a glyph's
// edge from the SDF's own gradient, so that one ramp covers one output pixel for
// every shape the Manhattan and wiggle point modes draw. Two things have to hold
// for that, and neither is checked by the compiler:
//
//   1. The gradient really is what the reasoning assumes. Unit for the disc and
//      for each of the triangle's three edges — but NOT for the diamond, whose
//      `1 - (|x| + |y|)` is the L1 norm and therefore sqrt(2) times the true
//      perpendicular distance to its edge. That sqrt(2) is exactly why the ramp
//      is measured rather than assumed, and a shape added later with its own
//      scaling would be silently mis-sized by any constant.
//
//   2. The ramp fits in the pad the quad leaves it. `discExpand` grows the quad
//      by AA_PAD_PX CSS px past the glyph edge; a ramp reaching further is
//      clipped by the rasterizer and the fade ends on a hard edge. This is what
//      the previous `fwidth`-as-half-width spelling got wrong, and it got it
//      wrong worst on the diagonals, where fwidth overshoots most.
//
// The shader isn't unit-testable, so this models it. Same approach, and same
// reason, as LinearSyntenyDisplay/shaders/syntenyFillPad.test.ts and
// DotplotDisplay/shaders/dotplotCapsulePad.test.ts.
// SYNC: keep in step with antialias.slang's glyphEdgeAlpha and with the SDFs
// in manhattan.slang.
import { AA_PAD_PX } from './pointGlyph.generated.ts'

const INV_SQRT5 = 1 / Math.sqrt(5)

// The four SDFs manhattan.slang selects between, over quad-local `p`. Positive
// inside, zero on the edge. SHAPE_BAR's constant 1 is the degenerate case the
// ramp's floor exists for.
const SDFS = {
  disc: (x: number, y: number) => 1 - Math.hypot(x, y),
  diamond: (x: number, y: number) => 1 - (Math.abs(x) + Math.abs(y)),
  triangle: (x: number, y: number) =>
    Math.min(1 - y, (2 * x + y + 1) * INV_SQRT5, (-2 * x + y + 1) * INV_SQRT5),
  bar: () => 1,
} as const

// |grad sdf| per unit of p, centrally differenced. Away from creases this is the
// exact analytic gradient.
function gradMag(sdf: (x: number, y: number) => number, x: number, y: number) {
  const h = 1e-6
  return Math.hypot(
    (sdf(x + h, y) - sdf(x - h, y)) / (2 * h),
    (sdf(x, y + h) - sdf(x, y - h)) / (2 * h),
  )
}

// Points ON each shape's edge, parameterised so the sweep covers every facing —
// including the diagonals, which is where fwidth overshot and where the disc's
// quad has least room to spare.
function edgePoints(shape: keyof typeof SDFS, n = 64): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    // Half-offset so no sample lands on an axis, i.e. on one of the diamond's
    // four corners — `|y|` has a kink at y = 0, so a central difference there
    // reports a gradient of 1 rather than the facet's sqrt(2). The corners are a
    // property of the shape, not of the ramp, and the shader meets them on 1-2
    // pixels per glyph.
    const a = ((i + 0.5) / n) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    if (shape === 'disc') {
      out.push([c, s])
    } else if (shape === 'diamond') {
      // scale the ray to the L1 unit ball
      const k = 1 / (Math.abs(c) + Math.abs(s))
      out.push([c * k, s * k])
    } else if (shape === 'triangle') {
      // walk the three edges rather than a ray, so corners are approached but
      // the samples themselves stay on a single facet
      const t = (i / n) * 3
      const seg = Math.floor(t)
      const f = 0.08 + (t - seg) * 0.84 // keep clear of the creases
      const verts: [number, number][] = [
        [-1, 1],
        [1, 1],
        [0, -1],
      ]
      const [ax, ay] = verts[seg]!
      const [bx, by] = verts[(seg + 1) % 3]!
      out.push([ax + (bx - ax) * f, ay + (by - ay) * f])
    }
  }
  return out
}

const RADII_PX = [1.5, 2, 4, 10]
const DPRS = [1, 2]

describe('glyph SDF gradients', () => {
  test('the disc and the triangle carry unit gradients', () => {
    for (const [x, y] of edgePoints('disc')) {
      expect(gradMag(SDFS.disc, x, y)).toBeCloseTo(1, 5)
    }
    for (const [x, y] of edgePoints('triangle')) {
      expect(gradMag(SDFS.triangle, x, y)).toBeCloseTo(1, 5)
    }
  })

  test('the diamond does not — its L1 norm carries sqrt(2)', () => {
    // The trap a hard-coded ramp width would fall into: this SDF reports a
    // distance sqrt(2) times the true perpendicular one, so a constant sized for
    // the disc would make the diamond's edge sqrt(2) too soft.
    for (const [x, y] of edgePoints('diamond')) {
      expect(gradMag(SDFS.diamond, x, y)).toBeCloseTo(Math.SQRT2, 5)
    }
  })

  test('the bar is constant, which is what the ramp floor is for', () => {
    expect(gradMag(SDFS.bar, 0.3, -0.4)).toBe(0)
    // 0.5 * max(0, 1e-5) is a positive half-ramp, and smoothstep of a coverage
    // far above it is 1 — the solid fill SHAPE_BAR wants.
    expect(0.5 * Math.max(0, 1e-5)).toBeGreaterThan(0)
  })
})

// The screen-space width of the ramp glyphEdgeAlpha produces, in DEVICE px, and
// how far it reaches outside the glyph edge in CSS px.
//
// `p` units relate to pixels through the glyph's radius: |p| = 1 sits at
// radiusPx CSS px from the center, so one device px is 1/(radiusPx*dpr) of p.
function rampGeometry(
  sdf: (x: number, y: number) => number,
  x: number,
  y: number,
  radiusPx: number,
  dpr: number,
  // how the shader turns its measured derivative into the smoothstep's
  // half-width. The shader halves it; the retired spelling used it whole.
  halfRampOf = (measuredPerDevicePx: number) => 0.5 * measuredPerDevicePx,
  // what the shader differentiates WITH. These are two separate quantities and
  // conflating them is what hides the bug: the ramp's width in coverage units
  // comes from whatever the shader measured, but converting that back to a
  // screen distance is the TRUE gradient's job. Divide by the measured value and
  // fwidth's overshoot cancels itself out and looks correct.
  measure = gradMag,
) {
  const trueG = gradMag(sdf, x, y)
  const pPerDevicePx = 1 / (radiusPx * dpr)
  const halfRamp = halfRampOf(measure(sdf, x, y) * pPerDevicePx)
  // Back to screen distance: coverage changes by trueG per unit of p, so the
  // half-ramp spans halfRamp/trueG of p, i.e. that times radiusPx CSS px.
  const halfRampCssPx = (halfRamp / trueG) * radiusPx
  return { widthDevicePx: 2 * halfRampCssPx * dpr, reachCssPx: halfRampCssPx }
}

// fwidth = |ddx| + |ddy|, which is what the retired spelling measured with.
function fwidthMag(
  sdf: (x: number, y: number) => number,
  x: number,
  y: number,
) {
  const h = 1e-6
  return (
    Math.abs((sdf(x + h, y) - sdf(x - h, y)) / (2 * h)) +
    Math.abs((sdf(x, y + h) - sdf(x, y - h)) / (2 * h))
  )
}

describe('glyphEdgeAlpha ramp', () => {
  test.each(['disc', 'diamond', 'triangle'] as const)(
    'is exactly one output pixel wide all the way round: %s',
    shape => {
      for (const [x, y] of edgePoints(shape)) {
        for (const radiusPx of RADII_PX) {
          for (const dpr of DPRS) {
            const { widthDevicePx } = rampGeometry(
              SDFS[shape],
              x,
              y,
              radiusPx,
              dpr,
            )
            expect(widthDevicePx).toBeCloseTo(1, 6)
          }
        }
      }
    },
  )

  test.each(['disc', 'diamond', 'triangle'] as const)(
    'fits inside the pad discExpand leaves: %s',
    shape => {
      for (const [x, y] of edgePoints(shape)) {
        for (const radiusPx of RADII_PX) {
          for (const dpr of DPRS) {
            const { reachCssPx } = rampGeometry(
              SDFS[shape],
              x,
              y,
              radiusPx,
              dpr,
            )
            expect(reachCssPx).toBeLessThanOrEqual(AA_PAD_PX)
          }
        }
      }
    },
  )

  test('fwidth as a half-width was both too wide and clipped (do not reintroduce)', () => {
    // The retired spelling, on the worst facing it has: a disc's 45-degree
    // point, at dpr 1. fwidth reads sqrt(2) there instead of 1, and was then
    // used whole as the half-width.
    const diag = Math.SQRT1_2
    const retired = rampGeometry(
      SDFS.disc,
      diag,
      diag,
      4,
      1,
      g => g, // used whole, not halved
      fwidthMag,
    )
    expect(retired.widthDevicePx).toBeCloseTo(2 * Math.SQRT2, 6)
    expect(retired.reachCssPx).toBeGreaterThan(AA_PAD_PX)

    // and on an axis-aligned facing it was merely 2x too wide, which is what
    // made the fade vary with position around one circle.
    const axis = rampGeometry(SDFS.disc, 1, 0, 4, 1, g => g, fwidthMag)
    expect(axis.widthDevicePx).toBeCloseTo(2, 6)
    expect(retired.widthDevicePx / axis.widthDevicePx).toBeCloseTo(
      Math.SQRT2,
      6,
    )

    // both are one pixel now, at every facing
    expect(rampGeometry(SDFS.disc, diag, diag, 4, 1).widthDevicePx).toBeCloseTo(
      1,
      6,
    )
    expect(rampGeometry(SDFS.disc, 1, 0, 4, 1).widthDevicePx).toBeCloseTo(1, 6)
  })
})
