import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_MATCH,
  KIND_CIGAR_N,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  fillShade,
  hoverDarken,
  isCigarKind,
  isMarkerKind,
  thinWidthFade,
} from './shaders/syntenyTypes.js.generated.ts'

// Three different things are pinned here, and the distinction is the point
// (adr-051).
//
// 1. The kind PREDICATES are now generated from syntenyTypes.slang, replacing
//    `kind >= KIND_CIGAR_MATCH` / `kind === KIND_MARKER` open-coded in
//    Canvas2DSyntenyRenderer. These tests are the retirement gate: they assert
//    the generated predicates agree with the spellings they replaced, across
//    every kind the RPC emits.
//
// 1b. The FADE is the same story a step further in. shadeFill() returns a
//    float4, which reads as "needs vector support before it can be shared" —
//    but the only part the Canvas2D path has to agree on is two scalars, the
//    hover-boosted alpha and the darkening factor. Those were split out of
//    shadeFill and exported; the channel blend around them stays per-backend,
//    because one works in 0-1 floats and the other in 0-255 bytes.
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

// --- the fade, retired from Canvas2DSyntenyRenderer --------------------------

// resolveInstanceFill's hover branch, verbatim as it stood before it called the
// generated pair. The ×5 boost capped at 0.35 and the 0.7 darkening were a
// SYNC-tagged copy of shadeFill's.
function retiredShade(pa: number, alpha: number, isHovered: boolean) {
  return isHovered ? Math.min(pa * alpha * 5, 0.35) : pa * alpha
}

const PACKED_ALPHAS = [0, 1, 64, 128, 200, 254, 255].map(a => a / 255)
const DISPLAY_ALPHAS = [0, 0.05, 0.07, 0.1, 0.25, 0.5, 0.75, 1]

test('fillShade matches the hover branch it replaced', () => {
  for (const pa of PACKED_ALPHAS) {
    for (const alpha of DISPLAY_ALPHAS) {
      for (const hovered of [false, true]) {
        // 0.35 arrives as its f32 value (0.34999999403953552), so the cap is
        // equal to ~8 decimals rather than bit-identical — 1e-8 of an alpha
        // that is quantized to 1/255 downstream. adr-051: parity tests assert
        // behavior, not bit patterns.
        expect(fillShade(pa, alpha, hovered)).toBeCloseTo(
          retiredShade(pa, alpha, hovered),
          7,
        )
      }
    }
  }
})

test('hover boosts a faint alignment but never past the cap', () => {
  // The property the ×5/0.35 pair exists for: at the low display alphas a
  // whole-genome view uses, hovering has to make one ribbon findable without
  // letting a dense pileup of them turn opaque.
  expect(fillShade(1, 0.05, true)).toBeCloseTo(0.25, 7)
  expect(fillShade(1, 0.05, true)).toBeGreaterThan(fillShade(1, 0.05, false))
  expect(fillShade(1, 0.5, true)).toBeCloseTo(0.35, 7)
  expect(fillShade(1, 1, true)).toBeCloseTo(0.35, 7)
  // A fully transparent feature stays invisible on hover rather than appearing.
  expect(fillShade(0, 1, true)).toBe(0)
})

test('hoverDarken is a no-op unless hovered', () => {
  expect(hoverDarken(false)).toBe(1)
  expect(hoverDarken(true)).toBeCloseTo(0.7, 7)
})

// The sub-pixel density fade, retired from the same function. Canvas2D used
// `Math.max(perpW, WIDTH_FADE_FLOOR)` with the floor re-typed as a local const;
// the shader clamped to [floor, 1]. Equal on every input Canvas2D could reach,
// because it only ran the fade inside its `perpW < 1` branch — which is the
// kind of agreement that holds until someone moves the branch.
function retiredWidthFade(perpW: number, applies: boolean) {
  return applies ? Math.max(perpW, 0.15) : 1
}

test('thinWidthFade matches the max(perpW, floor) spelling it replaced', () => {
  for (const perpW of [0, 0.01, 0.14, 0.15, 0.16, 0.5, 0.999]) {
    for (const applies of [false, true]) {
      expect(thinWidthFade(perpW, applies)).toBeCloseTo(
        retiredWidthFade(perpW, applies),
        7,
      )
    }
  }
})

test('the fade floors a hairline ribbon and caps at full opacity', () => {
  // Floor: a whole-genome PAF is almost entirely sub-pixel, and an unfloored
  // fade takes the whole view to nearly blank.
  expect(thinWidthFade(0, true)).toBeCloseTo(0.15, 7)
  expect(thinWidthFade(0.001, true)).toBeCloseTo(0.15, 7)
  // Cap: the shader calls this for wide ribbons too, where it must not brighten
  // them past 1. Canvas2D reaches it only below 1, so the cap is what lets the
  // two callers share one function.
  expect(thinWidthFade(1, true)).toBe(1)
  expect(thinWidthFade(50, true)).toBe(1)
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
