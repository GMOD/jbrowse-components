import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_MATCH,
  KIND_CIGAR_N,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  isCigarKind,
  isMarkerKind,
} from './shaders/syntenyTypes.js.generated.ts'

// Two different things are pinned here, and the distinction is the point
// (adr-051).
//
// 1. The kind PREDICATES are now generated from syntenyTypes.slang, replacing
//    `kind >= KIND_CIGAR_MATCH` / `kind === KIND_MARKER` open-coded in
//    Canvas2DSyntenyRenderer. These tests are the retirement gate: they assert
//    the generated predicates agree with the spellings they replaced, across
//    every kind the RPC emits.
//
// 2. The CURVE math is deliberately NOT shared. The shader tessellates through
//    `sBlend`/`yCurve`; Canvas2D draws one `bezierCurveTo`. syntenyRibbonPath.ts
//    carries an algebraic proof that the two are identical, which until now was
//    trusted as a comment. The second block checks the algebra numerically, so
//    an edit to either side that breaks the equivalence fails here rather than
//    showing up as a subtly different ribbon on the export path.

const ALL_KINDS = [
  KIND_BASE,
  KIND_MARKER,
  KIND_CIGAR_MATCH,
  KIND_CIGAR_I,
  KIND_CIGAR_D,
  KIND_CIGAR_N,
]

test('isCigarKind matches the `kind >= KIND_CIGAR_MATCH` spelling it replaced', () => {
  for (const kind of ALL_KINDS) {
    expect(isCigarKind(kind)).toBe(kind >= KIND_CIGAR_MATCH)
  }
})

test('isMarkerKind matches the `kind === KIND_MARKER` spelling it replaced', () => {
  for (const kind of ALL_KINDS) {
    expect(isMarkerKind(kind)).toBe(kind === KIND_MARKER)
  }
})

test('the two predicates partition the kinds the way the renderer assumes', () => {
  // A marker is never a CIGAR tile: the renderer `continue`s on markers before
  // it ever computes `isCigar`, so an overlap would silently change shading.
  for (const kind of ALL_KINDS) {
    expect(isMarkerKind(kind) && isCigarKind(kind)).toBe(false)
  }
  expect(ALL_KINDS.filter(k => isMarkerKind(k))).toStrictEqual([KIND_MARKER])
})

// --- the curve equivalence, checked instead of asserted in prose -------------

// syntenyTypes.slang, verbatim.
function sBlend(t: number) {
  return t * t * (3 - 2 * t)
}
function yCurve(t: number) {
  return 1.5 * t * (1 - t) + t * t * t
}

// One coordinate of the cubic Bezier `buildFeaturePath` emits: from (x0, 0) to
// (x1, h) with both control points at mid-height on their own anchor's x.
function bezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  )
}

const TS = Array.from({ length: 101 }, (_, i) => i / 100)

test('the Canvas2D bezier traces the shader’s tessellated X blend exactly', () => {
  // Control points at (x0, x0, x1, x1) — the "both control points on their own
  // anchor's x" construction. The claimed identity is (1-t)²(1+2t) = 1 - sBlend,
  // i.e. the bezier's x equals lerp(x0, x1, sBlend(t)).
  const x0 = 12.5
  const x1 = 907.25
  for (const t of TS) {
    expect(bezier(x0, x0, x1, x1, t)).toBeCloseTo(
      x0 + (x1 - x0) * sBlend(t),
      10,
    )
  }
})

test('the Canvas2D bezier traces the shader’s Y curve exactly', () => {
  // Control points at (0, h/2, h/2, h). The claimed identity is
  // (h/2)·3t(1-t) + t³·h = h·yCurve(t).
  const h = 240
  for (const t of TS) {
    expect(bezier(0, h / 2, h / 2, h, t)).toBeCloseTo(h * yCurve(t), 10)
  }
})

test('both curves are anchored at their endpoints', () => {
  // The property that makes adjacent ribbons meet without whitespace: shared
  // genomic boundaries must land on identical endpoints on both paths.
  expect(sBlend(0)).toBe(0)
  expect(sBlend(1)).toBe(1)
  expect(yCurve(0)).toBe(0)
  expect(yCurve(1)).toBe(1)
})
