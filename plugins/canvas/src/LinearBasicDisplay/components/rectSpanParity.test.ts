import { extendToMinWidthPx } from '@jbrowse/render-core/shaders/hpmath'

import { rectSpanPx } from '../passes/shaders/rect.js.generated.ts'
import { MIN_RECT_WIDTH_PX } from './sharedRendererConstants.ts'

// The retirement gate for `rectSpanPx`, and the first `//! js-export` whose
// answer is a PAIR rather than a scalar (adr-051).
//
// `paintedRectSpan` in Canvas2DFeatureRenderer used to compute both edges
// itself, mirroring the branch in rect.slang's `vs_main` by comment. The
// original is below verbatim; this file proves the generated pair reproduces it
// before the hand-written one stops being reviewed.
//
// It also pins the argument that made the two agree in the first place, which
// is the kind nobody re-derives on a later edit: the shader's point branch does
// NOT widen, and the hand-written twin did — harmless only because
// `round(x + 1) - round(x - 1)` is exactly `MIN_RECT_WIDTH_PX`, so the widen is
// a no-op there. Any change to the min width on one side breaks that silently.

function retiredPaintedSpan(
  isPoint: boolean,
  x1: number,
  x2: number,
): [number, number] {
  const sx1 = Math.round(isPoint ? x1 - MIN_RECT_WIDTH_PX / 2 : x1)
  const sx2 = extendToMinWidthPx(
    sx1,
    Math.round(isPoint ? x1 + MIN_RECT_WIDTH_PX / 2 : x2),
    MIN_RECT_WIDTH_PX,
  )
  return [sx1, sx2]
}

// Sub-pixel offsets first — the snap is where a half-pixel difference between
// `Math.round` and the shader's `floor(x + 0.5)` would show — then spans around
// and below the min width, in both orientations.
const XS = [0, 0.25, 0.5, 0.75, 1, 7.5, 100.5, -3.5, -0.5, 1000.25]
const DXS = [
  -40, -2.5, -2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2, 2.5, 40,
]

// `Math.round(x)` and the shader's `floor(x + 0.5)` agree on every input a
// canvas can be handed but ONE: at exactly -0.5 the first gives `-0` and the
// second `+0`. Every consumer treats them identically (they compare equal, and
// `fillRect` cannot tell), but Jest's deep equality is `Object.is`-based and
// does distinguish them, so the sweep would report a difference that is not
// one. Normalized here, and pinned on its own below so the difference stays
// recorded rather than merely absorbed.
const zeroNormalized = ([a, b]: [number, number]) => [a + 0, b + 0]

test('rectSpanPx matches the hand-written twin it replaced, on spans', () => {
  for (const x1 of XS) {
    for (const dx of DXS) {
      expect(zeroNormalized(rectSpanPx(x1, x1 + dx, false))).toStrictEqual(
        zeroNormalized(retiredPaintedSpan(false, x1, x1 + dx)),
      )
    }
  }
})

test('rectSpanPx matches the hand-written twin it replaced, on points', () => {
  for (const x1 of XS) {
    // A point's second argument is its own x — start === end is what selects
    // the branch — so it is passed, and ignored, exactly as the caller does.
    expect(zeroNormalized(rectSpanPx(x1, x1, true))).toStrictEqual(
      zeroNormalized(retiredPaintedSpan(true, x1, x1)),
    )
  }
})

test('the snap is the shader’s floor(x + 0.5), not Math.round', () => {
  // The whole of the difference between the two spellings, so that "they agree"
  // is a checked claim rather than a remembered one.
  expect(Object.is(rectSpanPx(-0.5, 40, false)[0], 0)).toBe(true)
  expect(Object.is(retiredPaintedSpan(false, -0.5, 40)[0], -0)).toBe(true)
})

test('a point straddles its coordinate rather than growing off one side', () => {
  // The property the branch exists for, asserted directly: an interbase cut
  // site sits BETWEEN two bases, so a one-sided tick would read as "cuts this
  // base" once zoomed in far enough to see them.
  const [left, right] = rectSpanPx(100, 100, true)
  expect(right - left).toBe(MIN_RECT_WIDTH_PX)
  expect((left + right) / 2).toBe(100)
})

test('a point stays a centered, min-width mark wherever it falls', () => {
  // The interbase RULE, at a few sub-pixel offsets — not a pixel-placement
  // assertion. Which pixel a tick lands on is best-effort between the backends;
  // that it straddles its coordinate instead of growing off one side is the
  // semantic difference between "cuts between these bases" and "cuts this one".
  for (const frac of [0, 0.25, 0.5, 0.75]) {
    const x = 100 + frac
    const [left, right] = rectSpanPx(x, x, true)
    expect(right - left).toBe(MIN_RECT_WIDTH_PX)
    expect(Math.abs((left + right) / 2 - x)).toBeLessThanOrEqual(0.5)
  }
})

test('a span is anchored at its start edge in both orientations', () => {
  // Forward: a narrow feature grows rightward off its start.
  expect(rectSpanPx(100, 100.3, false)).toStrictEqual([100, 102])
  // Reversed: the render axis runs leftward, so x1 is still the START — its
  // right edge — and the mark must grow leftward. Anchoring the leftmost edge
  // instead slides every narrow mark a full min-width, only on flipped
  // regions, which is why this is pinned rather than left to the sweep.
  expect(rectSpanPx(100, 98.7, false)).toStrictEqual([100, 98])
  // Already wide enough: both edges are just snapped.
  expect(rectSpanPx(100.4, 140.6, false)).toStrictEqual([100, 141])
})

test('a span whose ends snap together widens rightward, on both backends', () => {
  // Below about a pixel the two edges land on the SAME column, so the widen has
  // no direction left to preserve and grows in +x whichever way the block runs.
  // Recorded because it looks like the reversed-anchoring bug above and is not
  // one: the shader reaches it by the identical route (it ran this same widen
  // in clip space), so the backends agree. "Fixing" it on the Canvas2D side
  // alone would introduce the drift this file exists to prevent — it needs the
  // orientation passed in, and that is a change to both.
  expect(rectSpanPx(100, 99.7, false)).toStrictEqual([100, 102])
  expect(rectSpanPx(100, 99.7, false)).toStrictEqual(
    retiredPaintedSpan(false, 100, 99.7),
  )
})
