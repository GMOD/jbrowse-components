import { fillSpanRect } from './rendererUtils.ts'
import { expandToMinWidthPx } from './spanMinWidth.generated.ts'

// The retirement gate for `expandToMinWidthPx`, which `coverageBar.slang` lifts
// out of `hpmath.slang` into this package (adr-051). `fillSpanRect` open-coded
// the midpoint rule as `w < 1 ? (px + px2) / 2 - 0.5 : px`; that spelling is
// kept below as the fixture and swept, the pattern `hpmathParity.test.ts` set.
//
// The sweep favours where this historically broke. Both halves of the rule have
// shipped wrong separately — the gap pass took the 1px floor without the
// centering, and the coverage bar handed the pivot a seam-fudged width, moving
// the switch from a 1px span to a 0.2px one — so the boundary at exactly 1 px is
// crossed from both sides, and the seam-pad range 0.2..1 has its own case below.

function retiredMinWidthLeft(px: number, px2: number) {
  const w = px2 - px
  return w < 1 ? (px + px2) / 2 - 0.5 : px
}

// Sub-pixel through several px, in steps fine enough to land on and around 1.
const SPANS = [0, 0.05, 0.2, 0.4, 0.6, 0.8, 0.9999, 1, 1.0001, 1.3, 2, 7.25, 40]
// Left edges including negatives (a mark straddling the viewport's left edge)
// and a large one (a block far along a wide canvas).
const LEFTS = [-53.5, -1, -0.25, 0, 0.5, 17, 1920.75]

test('the generated rule reproduces the left edge fillSpanRect open-coded', () => {
  for (const px of LEFTS) {
    for (const span of SPANS) {
      expect(expandToMinWidthPx(px, px + span, 1)[0]).toBe(
        retiredMinWidthLeft(px, px + span),
      )
    }
  }
})

test('a sub-pixel span comes back exactly 1 px wide, centred on itself', () => {
  for (const px of LEFTS) {
    for (const span of SPANS.filter(s => s < 1)) {
      const [left, right] = expandToMinWidthPx(px, px + span, 1)
      expect(right - left).toBeCloseTo(1, 10)
      expect((left + right) / 2).toBeCloseTo(px + span / 2, 10)
    }
  }
})

test('a span already at least 1 px is left alone, both edges', () => {
  for (const px of LEFTS) {
    for (const span of SPANS.filter(s => s >= 1)) {
      expect(expandToMinWidthPx(px, px + span, 1)).toStrictEqual([
        px,
        px + span,
      ])
    }
  }
})

// The seam pad is not part of the rule, and this is where that shows: on a true
// span between 0.2 and 1 px, `max(span + pad, expanded)` and `expanded + pad`
// disagree, and the first is what has shipped. Pinned because the twin now
// supplies `expanded`, which makes the second spelling a one-word edit.
test('the seam pad widens the drawn bar without moving the sub-pixel switch', () => {
  const drawn = (px: number, px2: number, pad: number) => {
    const calls: number[][] = []
    fillSpanRect(
      { fillRect: (...a: number[]) => calls.push(a) } as never,
      px,
      px2,
      0,
      10,
      pad,
    )
    return { left: calls[0]![0]!, width: calls[0]![2]! }
  }
  // 0.5px span: the pad applies, and the floor is still 1 — not 1.5.
  expect(drawn(0, 0.5, 0.8).width).toBeCloseTo(1.3, 10)
  // and the mark is still centred on its span, pad or no pad
  expect(drawn(0, 0.5, 0.8).left).toBeCloseTo(drawn(0, 0.5, 0).left, 10)
  // Past 1px the pad is the whole difference.
  expect(drawn(0, 4, 0.8).width).toBeCloseTo(4.8, 10)
  expect(drawn(0, 4, 0.8).left).toBe(0)
})
