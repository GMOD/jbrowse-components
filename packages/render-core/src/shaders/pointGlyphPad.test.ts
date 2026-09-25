// `discExpand` sizes the quad the vertex stage emits; `glyphEdgeAlpha` shades a
// ramp inside it. The two are sized from one number and nothing in the build
// holds them to each other, so this asserts the invariant directly: every point
// the fragment stage would give non-zero alpha lies inside the quad.
//
// `glyphEdgeAlpha.test.ts` is the fragment half — it pins the ramp at one output
// pixel for each SDF. This is the vertex half, and the two differ in what they
// import: that file models the pad, this one runs `discExpand` itself, because a
// pad test spelling its own copy of the expansion is a copy that agrees with
// itself. Same reason the scalars in dotplotCapsulePad.test.ts are imported.
//
// SYNC: keep the quad model in step with pointMark.slang's vs_main and
// wiggle.slang's scatter branch, and the pieces with the SDFs in fs_main.
import { aaHalfPx, aaRamp } from './antialias.js.generated.ts'
import { discExpand } from './pointGlyph.js.generated.ts'
import { DIAMOND_GLYPH_SCALE } from './pointMark.consts.generated.ts'

const INV_SQRT5 = 1 / Math.sqrt(5)

type Piece = (x: number, y: number) => number

// Each glyph's SDF as the smooth pieces it is the minimum of, rather than the
// closed form the shader writes. A central difference across a crease reports
// neither facet's gradient — it reports 1 where the diamond's axis facets carry
// sqrt(2) — and the diamond's creases are exactly the four directions its quad
// binds in, so the composite form cannot answer the question this file asks.
const PIECES: Record<Shape, Piece[]> = {
  disc: [(x, y) => 1 - Math.hypot(x, y)],
  diamond: [
    (x, y) => 1 - (x + y),
    (x, y) => 1 - (x - y),
    (x, y) => 1 - (y - x),
    (x, y) => 1 + x + y,
  ],
  triangle: [
    (_x, y) => 1 - y,
    (x, y) => (2 * x + y + 1) * INV_SQRT5,
    (x, y) => (-2 * x + y + 1) * INV_SQRT5,
  ],
}

type Shape = 'disc' | 'diamond' | 'triangle'

function activePiece(shape: Shape, x: number, y: number) {
  let best = PIECES[shape][0]!
  for (const piece of PIECES[shape]) {
    if (piece(x, y) < best(x, y)) {
      best = piece
    }
  }
  return best
}

function coverage(shape: Shape, x: number, y: number) {
  return activePiece(shape, x, y)(x, y)
}

// `glyphEdgeAlpha` at a point `(xPx, yPx)` from the glyph centre. `sdfUnitPx` is
// how many CSS px one unit of the quad-local coord spans, which is what carries
// the measured gradient from SDF units to the screen.
function alphaAt(
  shape: Shape,
  xPx: number,
  yPx: number,
  sdfUnitPx: number,
  dpr: number,
) {
  const x = xPx / sdfUnitPx
  const y = yPx / sdfUnitPx
  const piece = activePiece(shape, x, y)
  const h = 1e-7
  const gradient = Math.hypot(
    (piece(x + h, y) - piece(x - h, y)) / (2 * h),
    (piece(x, y + h) - piece(x, y - h)) / (2 * h),
  )
  return aaRamp(piece(x, y), gradient / (sdfUnitPx * dpr))
}

// Half-extent of the axis-aligned box holding every inked fragment, in CSS px —
// the smallest quad that would not clip the ramp. Radial, because the inked
// region is star-shaped about the centre for all three shapes; the angle count
// is a multiple of 4 so the axes and the triangle's apex are sampled exactly.
function inkedHalfExtentPx(shape: Shape, sdfUnitPx: number, dpr: number) {
  let extent = 0
  const angles = 512
  for (let i = 0; i < angles; i++) {
    const a = (2 * Math.PI * i) / angles
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    let lo = 0
    let hi = sdfUnitPx * 4 + 4
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      if (alphaAt(shape, cx * mid, cy * mid, sdfUnitPx, dpr) > 0) {
        lo = mid
      } else {
        hi = mid
      }
    }
    extent = Math.max(extent, Math.abs(cx * lo), Math.abs(cy * lo))
  }
  return extent
}

// pointMark.slang's `halfPx`, and with a scale of 1 also wiggle.slang's.
function quadHalfExtentPx(radiusPx: number, dpr: number, glyphScale = 1) {
  return radiusPx * discExpand(radiusPx, dpr) * glyphScale
}

// One unit of `localPos` in CSS px: `halfPx / expand`, which is where the glyph
// boundary lands.
function sdfUnitPx(radiusPx: number, glyphScale = 1) {
  return radiusPx * glyphScale
}

// Sub-pixel radii are reachable: `marks.size` is an unfloored config number and
// pointMark.slang routes only GLYPH_DISC to the crisp-square fallback, so a
// 0.8 px diamond or triangle arrives here at radius 0.4.
const RADII_PX = [0.1, 0.4, 0.5, 1, 1.5, 4, 10]
const DPRS = [1, 2, 3]

describe('the pieces model the SDFs fs_main branches to', () => {
  test.each([
    [0.3, -0.2],
    [-0.7, 0.1],
    [0, 0.9],
    [1.4, 0],
    [-0.5, -0.5],
  ])('at (%p, %p)', (x, y) => {
    expect(coverage('disc', x, y)).toBeCloseTo(1 - Math.hypot(x, y), 12)
    expect(coverage('diamond', x, y)).toBeCloseTo(
      1 - (Math.abs(x) + Math.abs(y)),
      12,
    )
    expect(coverage('triangle', x, y)).toBeCloseTo(
      Math.min(
        1 - y,
        (2 * x + y + 1) * INV_SQRT5,
        (-2 * x + y + 1) * INV_SQRT5,
      ),
      12,
    )
  })
})

describe('discExpand', () => {
  // The regression. Clamping the divisor made this `radiusPx + aaHalfPx` only
  // above the clamp, because the caller scales by the unclamped radius: at
  // radius 0.4 and dpr 2 the pad came out 0.12 px against a 0.25 px reach.
  test.each(DPRS)(
    'pads by exactly one ramp reach at every radius: dpr %p',
    dpr => {
      for (const radiusPx of RADII_PX) {
        expect(quadHalfExtentPx(radiusPx, dpr) - radiusPx).toBeCloseTo(
          aaHalfPx(dpr),
          12,
        )
      }
    },
  )

  // The disc is what wiggle's scatter branch and pointMark's GLYPH_DISC draw,
  // both at `halfPx = radiusPx * expand`. Its ramp is isotropic, so the quad is
  // tight — equals, not merely holds.
  test.each(DPRS)(
    'gives the disc a quad that is exactly its ink: dpr %p',
    dpr => {
      for (const radiusPx of RADII_PX) {
        expect(inkedHalfExtentPx('disc', sdfUnitPx(radiusPx), dpr)).toBeCloseTo(
          quadHalfExtentPx(radiusPx, dpr),
          6,
        )
      }
    },
  )
})

describe('the scaled diamond', () => {
  test.each(DPRS)('keeps its whole ramp inside the quad: dpr %p', dpr => {
    for (const radiusPx of RADII_PX) {
      const inked = inkedHalfExtentPx(
        'diamond',
        sdfUnitPx(radiusPx, DIAMOND_GLYPH_SCALE),
        dpr,
      )
      expect(inked).toBeLessThanOrEqual(
        quadHalfExtentPx(radiusPx, dpr, DIAMOND_GLYPH_SCALE) + 1e-9,
      )
    }
  })

  // Why `discExpand` is called on the UNSCALED radius while `halfPx` scales
  // after it, which reads like an oversight and is not. An L1 boundary's ramp
  // is perpendicular to a 45-degree facet, so where the quad binds — the four
  // corners, on the axes — the ink reaches sqrt(2) ramp reaches out, not one.
  // Scaling the radius into discExpand would pad by one reach there and cut the
  // corners at alpha 0.146; the surviving factor of DIAMOND_GLYPH_SCALE covers
  // sqrt(2) with room to spare, and this is what fails if that constant drops
  // below it.
  test.each(DPRS)(
    'needs sqrt(2) reaches at its corners, not one: dpr %p',
    dpr => {
      for (const radiusPx of RADII_PX) {
        const unitPx = sdfUnitPx(radiusPx, DIAMOND_GLYPH_SCALE)
        const inked = inkedHalfExtentPx('diamond', unitPx, dpr)
        expect(inked - unitPx).toBeCloseTo(Math.SQRT2 * aaHalfPx(dpr), 6)
        expect(inked).toBeGreaterThan(unitPx + aaHalfPx(dpr))
        expect(DIAMOND_GLYPH_SCALE).toBeGreaterThan(Math.SQRT2)
      }
    },
  )
})

// A shortfall this file records rather than fixes: the triangle's quad holds
// the ramp along all three edges and not around the corners, where two offset
// edges miter out to sqrt(5) reaches at the apex. The cut is sub-pixel and
// independent of the radius clamp — it survives the fix above — so closing it
// means padding the quad per glyph, which nothing else in the shape needs.
test.each(DPRS)('the triangle still loses its corner miters: dpr %p', dpr => {
  for (const radiusPx of RADII_PX) {
    const unitPx = sdfUnitPx(radiusPx)
    const inked = inkedHalfExtentPx('triangle', unitPx, dpr)
    expect(inked - unitPx).toBeCloseTo(Math.sqrt(5) * aaHalfPx(dpr), 6)
    expect(inked).toBeGreaterThan(quadHalfExtentPx(radiusPx, dpr))
  }
})
