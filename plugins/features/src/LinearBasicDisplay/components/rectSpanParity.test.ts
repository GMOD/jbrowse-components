import { extendToMinWidthPx } from '@jbrowse/render-core/shaders/hpmath'

import { rectSpanPx } from '../passes/shaders/rect.js.generated.ts'
import { MIN_RECT_WIDTH_PX } from './sharedRendererConstants.ts'

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

// Sub-pixel offsets first, where a half-pixel difference between `Math.round` and
// the shader's `floor(x + 0.5)` would show.
const XS = [0, 0.25, 0.5, 0.75, 1, 7.5, 100.5, -3.5, -0.5, 1000.25]
const DXS = [
  -40, -2.5, -2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2, 2.5, 40,
]

// `Math.round(x)` and the shader's `floor(x + 0.5)` agree on every input but
// -0.5, where one gives `-0` and the other `+0`. No consumer can tell them apart,
// but Jest's deep equality is `Object.is`-based and does.
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
    // A point's second argument is its own x — start === end selects the branch
    // — so it is passed and ignored exactly as the caller does.
    expect(zeroNormalized(rectSpanPx(x1, x1, true))).toStrictEqual(
      zeroNormalized(retiredPaintedSpan(true, x1, x1)),
    )
  }
})

test('the snap is the shader’s floor(x + 0.5), not Math.round', () => {
  expect(Object.is(rectSpanPx(-0.5, 40, false)[0], 0)).toBe(true)
  expect(Object.is(retiredPaintedSpan(false, -0.5, 40)[0], -0)).toBe(true)
})

test('a point straddles its coordinate rather than growing off one side', () => {
  // An interbase cut site sits between two bases, so a one-sided tick reads as
  // "cuts this base" once zoomed in far enough to see them.
  const [left, right] = rectSpanPx(100, 100, true)
  expect(right - left).toBe(MIN_RECT_WIDTH_PX)
  expect((left + right) / 2).toBe(100)
})

test('a point stays a centered, min-width mark wherever it falls', () => {
  // Which pixel a tick lands on is best-effort between the backends; that it
  // straddles its coordinate is the part that carries meaning.
  for (const frac of [0, 0.25, 0.5, 0.75]) {
    const x = 100 + frac
    const [left, right] = rectSpanPx(x, x, true)
    expect(right - left).toBe(MIN_RECT_WIDTH_PX)
    expect(Math.abs((left + right) / 2 - x)).toBeLessThanOrEqual(0.5)
  }
})

test('a span is anchored at its start edge in both orientations', () => {
  expect(rectSpanPx(100, 100.3, false)).toStrictEqual([100, 102])
  // Reversed, the render axis runs leftward and x1 is still the START, its right
  // edge, so the mark grows leftward; anchoring the leftmost edge would slide
  // every narrow mark a full min-width on flipped regions.
  expect(rectSpanPx(100, 98.7, false)).toStrictEqual([100, 98])
  expect(rectSpanPx(100.4, 140.6, false)).toStrictEqual([100, 141])
})

test('a span whose ends snap together widens rightward, on both backends', () => {
  // Below about a pixel both edges land on the same column, so the widen has no
  // direction left to preserve and grows in +x whichever way the block runs. It
  // looks like the reversed-anchoring case above and is not one: the shader
  // reaches it by the identical route, so the backends agree.
  expect(rectSpanPx(100, 99.7, false)).toStrictEqual([100, 102])
  expect(rectSpanPx(100, 99.7, false)).toStrictEqual(
    retiredPaintedSpan(false, 100, 99.7),
  )
})
