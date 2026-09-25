// `glyphExpand` sizes the quad the vertex stage emits; `glyphEdgeAlpha` shades a
// ramp inside it. The two are sized from one number and nothing in the build
// holds them to each other, so this asserts the invariant directly: every point
// the fragment stage would give non-zero alpha lies inside the quad.
//
// `glyphEdgeAlpha.test.ts` is the fragment half — it pins the ramp at one output
// pixel for each SDF. This is the vertex half, and the two differ in what they
// import: that file models the pad, this one runs `glyphExpand` itself, because
// a pad test spelling its own copy of the expansion is a copy that agrees with
// itself. Same reason the scalars in dotplotCapsulePad.test.ts are imported.
//
// SYNC: keep the quad model in step with pointMark.slang's vs_main and
// wiggle.slang's scatter branch, and the pieces with the SDFs in fs_main.
import { aaHalfPx, aaRamp } from './antialias.js.generated.ts'
import { discExpand, glyphExpand } from './pointGlyph.js.generated.ts'
import {
  DIAMOND_GLYPH_SCALE,
  DIAMOND_MITER_REACHES,
  TRIANGLE_MITER_REACHES,
} from './pointMark.consts.generated.ts'

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

// pointMark.slang's `halfPx`, and with a scale and a reach of 1 also
// wiggle.slang's.
function quadHalfExtentPx(
  radiusPx: number,
  dpr: number,
  glyphScale = 1,
  reaches = 1,
) {
  const unitPx = sdfUnitPx(radiusPx, glyphScale)
  return unitPx * glyphExpand(unitPx, reaches, dpr)
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

describe('glyphExpand', () => {
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

  // wiggle.slang's scatter branch calls `discExpand`, which is the one-reach
  // case of the same expansion rather than a second rule.
  test.each(DPRS)('discExpand is the one-reach case: dpr %p', dpr => {
    for (const radiusPx of RADII_PX) {
      expect(discExpand(radiusPx, dpr)).toBe(glyphExpand(radiusPx, 1, dpr))
    }
  })

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

// Neither of the two carved glyphs binds its quad on a single facet, so neither
// pads by one reach. An L1 boundary's ramp runs perpendicular to a 45-degree
// facet, so at the diamond's four corners — on the axes, which is where its
// quad binds — two offset facets miter out sqrt(2) reaches. The triangle's apex
// is the same construction at a much sharper angle: sqrt(5).
describe.each([
  ['diamond', DIAMOND_GLYPH_SCALE, DIAMOND_MITER_REACHES, Math.SQRT2],
  ['triangle', 1, TRIANGLE_MITER_REACHES, Math.sqrt(5)],
] as const)('the %s', (shape, glyphScale, reaches, miter) => {
  test('pads by the miter its corners reach', () => {
    expect(reaches).toBeCloseTo(miter, 6)
  })

  test.each(DPRS)('keeps its whole ramp inside the quad: dpr %p', dpr => {
    for (const radiusPx of RADII_PX) {
      const unitPx = sdfUnitPx(radiusPx, glyphScale)
      const inked = inkedHalfExtentPx(shape, unitPx, dpr)
      expect(inked - unitPx).toBeCloseTo(miter * aaHalfPx(dpr), 6)
      expect(inked).toBeLessThanOrEqual(
        quadHalfExtentPx(radiusPx, dpr, glyphScale, reaches) + 1e-9,
      )
    }
  })

  // What a one-reach pad costs: the quad cuts the corner, and the fragment the
  // rasterizer stops at is still well inside the ramp. 0.146 for the diamond,
  // 0.276 for the triangle, at every radius and dpr — sub-pixel, and a hard
  // edge on the one feature of the glyph a reader picks it out by.
  test.each(DPRS)('a one-reach pad would cut that corner: dpr %p', dpr => {
    for (const radiusPx of RADII_PX) {
      const unitPx = sdfUnitPx(radiusPx, glyphScale)
      const cut = quadHalfExtentPx(radiusPx, dpr, glyphScale) - unitPx
      const alpha = alphaAt(
        shape,
        0,
        shape === 'diamond' ? unitPx + cut : -(unitPx + cut),
        unitPx,
        dpr,
      )
      expect(alpha).toBeCloseTo(shape === 'diamond' ? 0.146 : 0.276, 3)
    }
  })
})
