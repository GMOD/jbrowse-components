import {
  KIND_BASE,
  KIND_BASE_TILE,
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
  isTileKind,
  sBlend,
  thinWidthFade,
  yCurve,
} from './shaders/syntenyTypes.js.generated.ts'
import {
  buildFeaturePath,
  strokeCenterline,
  strokeFeatureSideEdges,
} from './syntenyRibbonPath.ts'

import type { CanvasLike } from './syntenyRibbonPath.ts'

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
//
// It is no longer the reference for every input, and deliberately so: the cap it
// applies is a cap on the ALPHA, which runs hover backwards above 0.35 (see the
// test below). fillShade caps the BOOST instead. The two agree wherever the old
// spelling was right, and this stays as the pin on that agreement.
function retiredShade(pa: number, alpha: number, isHovered: boolean) {
  return isHovered ? Math.min(pa * alpha * 5, 0.35) : pa * alpha
}

const PACKED_ALPHAS = [0, 1, 64, 128, 200, 254, 255].map(a => a / 255)
const DISPLAY_ALPHAS = [0, 0.05, 0.07, 0.1, 0.25, 0.5, 0.75, 1]

test('fillShade matches the hover branch it replaced below the cap', () => {
  for (const pa of PACKED_ALPHAS) {
    for (const alpha of DISPLAY_ALPHAS) {
      for (const hovered of [false, true]) {
        if (hovered && pa * alpha > 0.35) {
          continue
        }
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
  expect(fillShade(1, 0.07, true)).toBeCloseTo(0.35, 7)
  expect(fillShade(1, 0.2, true)).toBeCloseTo(0.35, 7)
  // A fully transparent feature stays invisible on hover rather than appearing.
  expect(fillShade(0, 1, true)).toBe(0)
})

test('hover never makes a ribbon fainter than it already was', () => {
  // The cap is on the boost, not on the alpha. Capping the alpha meant that
  // above 0.35 — which the opacity slider reaches, it runs to 1.0 — hovering
  // DROPPED a ribbon's alpha (at opacity 1 it went 1.0 -> 0.35), so the ribbon
  // under the cursor became the faintest one on screen. hoverDarken's 0.7 on the
  // rgb cannot compensate for that; it darkens a ribbon that is now barely
  // composited at all.
  for (const pa of PACKED_ALPHAS) {
    for (const alpha of DISPLAY_ALPHAS) {
      expect(fillShade(pa, alpha, true)).toBeGreaterThanOrEqual(
        fillShade(pa, alpha, false),
      )
    }
  }
  expect(fillShade(1, 1, true)).toBe(1)
  expect(fillShade(1, 0.5, true)).toBeCloseTo(0.5, 7)
  // and the old spelling is what this is guarding against
  expect(retiredShade(1, 1, true)).toBeLessThan(retiredShade(1, 1, false))
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
    for (const fadeThin of [false, true]) {
      expect(thinWidthFade(perpW, KIND_BASE, fadeThin)).toBeCloseTo(
        retiredWidthFade(perpW, fadeThin),
        7,
      )
    }
  }
})

test('the fade floors a hairline ribbon and caps at full opacity', () => {
  // Floor: a whole-genome PAF is almost entirely sub-pixel, and an unfloored
  // fade takes the whole view to nearly blank.
  expect(thinWidthFade(0, KIND_BASE, true)).toBeCloseTo(0.15, 7)
  expect(thinWidthFade(0.001, KIND_BASE, true)).toBeCloseTo(0.15, 7)
  // Cap: the shader calls this for wide ribbons too, where it must not brighten
  // them past 1. Canvas2D reaches it only below 1, so the cap is what lets the
  // two callers share one function.
  expect(thinWidthFade(1, KIND_BASE, true)).toBe(1)
  expect(thinWidthFade(50, KIND_BASE, true)).toBe(1)
})

test('an indel quad and a marker tick take no fade at all', () => {
  for (const kind of [KIND_CIGAR_I, KIND_CIGAR_D, KIND_CIGAR_N, KIND_MARKER]) {
    for (const fadeThin of [false, true]) {
      expect(thinWidthFade(0.01, kind, fadeThin)).toBe(1)
    }
  }
})

// The three things that separate a match tile from the whole-span base it is
// otherwise painted as. Each is what stops N tiles packed a perpendicular width
// apart, every one of them drawn over a 1px minimum footprint, from compositing
// to more ink than the one ribbon they partition.
test('a match tile fades by its own width, unfloored and unswitchable', () => {
  // Unswitchable: the display toggle is about whether each ALIGNMENT is drawn
  // at full alpha, and a tile is not an alignment.
  for (const fadeThin of [false, true]) {
    expect(thinWidthFade(0.4, KIND_BASE_TILE, fadeThin)).toBeCloseTo(0.4, 7)
  }
  // Unfloored: a whole-ribbon floor keeps a lone hairline locatable, and a tile
  // is locatable through its neighbours. Floored, 20 of these per pixel would
  // stack to 2.3x the ink of the ribbon they tile.
  expect(thinWidthFade(0.05, KIND_BASE_TILE, true)).toBeCloseTo(0.05, 7)
  // Capped like every other kind — a tile wide enough to fill a pixel is a
  // plain fill, and must not be brightened past it.
  expect(thinWidthFade(9, KIND_BASE_TILE, true)).toBe(1)
})

test('the tile kind is its own kind, not a CIGAR or marker one', () => {
  expect(isTileKind(KIND_BASE_TILE)).toBe(true)
  for (const kind of [KIND_BASE, KIND_MARKER, KIND_CIGAR_I, KIND_CIGAR_D]) {
    expect(isTileKind(kind)).toBe(false)
  }
  // It colors and outlines as a base ribbon, which is what these two decide.
  expect(isCigarKind(KIND_BASE_TILE)).toBe(false)
  expect(isMarkerKind(KIND_BASE_TILE)).toBe(false)
})

// --- the curve equivalence, checked instead of asserted in prose -------------
//
// `sBlend`/`yCurve` are the shader's own, generated. They were re-spelled here
// under a "syntenyTypes.slang, verbatim" comment, which made the test that
// exists to catch twins carry one: a sign error in the copy would have made
// these pass while the shader drew something else.
//
// The control points are the ones `buildFeaturePath` actually emits, recorded
// through a fake canvas, rather than the hand-written `(x0, x0, x1, x1)` the
// prose describes. Same reason: what needs checking is the path the Canvas2D
// backend draws, not a restatement of it.

// Records path commands instead of drawing them.
function recordingCtx() {
  const beziers: number[][] = []
  const lines: number[][] = []
  // A curve's start point is implicit in Canvas2D — wherever the path already
  // is, which ANY of the three commands can have set. "The last moveTo" is
  // wrong for the fill path's closing edge, which starts at a lineTo.
  let current: [number, number] = [Number.NaN, Number.NaN]
  const ctx: CanvasLike = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {},
    closePath() {},
    moveTo(x, y) {
      current = [x, y]
    },
    lineTo(x, y) {
      lines.push([x, y])
      current = [x, y]
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      beziers.push([...current, cp1x, cp1y, cp2x, cp2y, x, y])
      current = [x, y]
    },
    fill() {},
    stroke() {},
  }
  return { ctx, beziers, lines }
}

// One coordinate of a recorded cubic at parameter t.
function cubicAt(p: readonly number[], axis: 0 | 1, t: number) {
  const [p0, p1, p2, p3] = [p[axis]!, p[2 + axis]!, p[4 + axis]!, p[6 + axis]!]
  const u = 1 - t
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  )
}

const TS = Array.from({ length: 101 }, (_, i) => i / 100)
const yTop = 40
const height = 240
const corners = { sx1: 12.5, sx2: 30, sx3: 907.25, sx4: 250 }

/**
 * Assert a recorded bezier is the shader's edge from `xTop` at the band's top to
 * `xBottom` at its bottom.
 *
 * `traced` is which way the TS walks it. The shader always runs top-to-bottom (t
 * is the band fraction), but the fill path closes AROUND the ribbon, so its
 * second edge is emitted bottom-to-top. A reversed cubic — endpoints and control
 * points both swapped — is exactly B(1-t), so this flips the parameter rather
 * than the expectation. Checking x and y at the SAME t is what makes it the same
 * curve rather than merely the same set of points.
 */
function expectTracesShaderCurve(
  bezier: readonly number[],
  xTop: number,
  xBottom: number,
  traced: 'downward' | 'upward',
) {
  for (const t of TS) {
    const s = traced === 'downward' ? t : 1 - t
    expect(cubicAt(bezier, 0, t)).toBeCloseTo(
      xTop + (xBottom - xTop) * sBlend(s),
      9,
    )
    expect(cubicAt(bezier, 1, t)).toBeCloseTo(yTop + height * yCurve(s), 9)
  }
}

test('the fill path’s edges trace the curve the shader evaluates', () => {
  const { ctx, beziers } = recordingCtx()
  buildFeaturePath(ctx, corners, yTop, height, true)
  expect(beziers).toHaveLength(2)
  expectTracesShaderCurve(beziers[0]!, corners.sx1, corners.sx4, 'downward')
  expectTracesShaderCurve(beziers[1]!, corners.sx2, corners.sx3, 'upward')
})

// The outline pass and the thin-ribbon centerline draw the same curve through
// separate call sites, so each is its own chance to write `height / 3`.
test('the outline and centerline strokes trace it too', () => {
  const outline = recordingCtx()
  strokeFeatureSideEdges(outline.ctx, corners, yTop, height, true)
  expect(outline.beziers).toHaveLength(2)
  expectTracesShaderCurve(
    outline.beziers[0]!,
    corners.sx1,
    corners.sx4,
    'downward',
  )
  expectTracesShaderCurve(
    outline.beziers[1]!,
    corners.sx2,
    corners.sx3,
    'downward',
  )

  // A degenerate (zero-width) instance, so its centerline endpoints are its
  // corners — which is exactly the KIND_MARKER case this branch draws.
  const center = recordingCtx()
  strokeCenterline(
    center.ctx,
    { sx1: 100, sx2: 100, sx3: 220, sx4: 220 },
    yTop,
    height,
    true,
  )
  expect(center.beziers).toHaveLength(1)
  expectTracesShaderCurve(center.beziers[0]!, 100, 220, 'downward')
})

// Straight mode has no curve at all — the straight passes are separate shaders
// with no cubic in them.
test('straight mode emits no curve', () => {
  const { ctx, beziers, lines } = recordingCtx()
  buildFeaturePath(ctx, corners, yTop, height, false)
  expect(beziers).toEqual([])
  expect(lines).toEqual([
    [corners.sx4, yTop + height],
    [corners.sx3, yTop + height],
    [corners.sx2, yTop],
  ])
})

test('both curves are anchored at their endpoints', () => {
  // The property that makes adjacent ribbons meet without whitespace: shared
  // genomic boundaries must land on identical endpoints on both paths.
  expect(sBlend(0)).toBe(0)
  expect(sBlend(1)).toBe(1)
  expect(yCurve(0)).toBe(0)
  expect(yCurve(1)).toBe(1)
})
