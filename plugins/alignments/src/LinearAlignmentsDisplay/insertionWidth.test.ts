import {
  LONG_INSERTION_MIN_LENGTH,
  MIN_HEIGHT_FOR_TEXT,
  insertionBarWidth,
  textWidthForNumber,
} from './constants.ts'

// This file used to be insertion.slang's `//! js-export` retirement gate
// (adr-051): a sweep pinning the generated `insertionBarWidthPx` against a
// verbatim copy of the hand-written mirror it replaced. That gate did its job —
// the mirror is gone and nothing reads it — and holding onto it would now pin a
// bug, because the retired mirror had one: the `long` branch was
// `min(5, insWPx/3)` with no floor.
//
// What replaces it is the set of properties the width rule actually has to
// hold, which is strictly more than "reproduces the old spelling".

const pxPerBps = [0.01, 0.1, 0.5, 1, 2, 5, 6.5, 7, 10, 20, 50]
// A tall (normal/compact preset) row and a super-compact one: the latter is
// below MIN_HEIGHT_FOR_TEXT, so large insertions shrink to the narrow bar.
const featureHeights = [10, 1]
const lengths = [1, 5, 9, 10, 11, 15, 29, 30, 50, 100, 500, 10000]

test('a marker is never sub-pixel, at any length or zoom', () => {
  for (const pxPerBp of pxPerBps) {
    for (const featureHeight of featureHeights) {
      for (const length of lengths) {
        expect(
          insertionBarWidth(length, pxPerBp, featureHeight),
        ).toBeGreaterThanOrEqual(1)
      }
    }
  }
})

// The regression this floor exists for. `min(5, insWPx/3)` goes under 1px
// whenever the insertion spans less than 3 screen px, so a `long` insertion drew
// NARROWER than a `small` one — 0.33px against a hard 1.0 for a 10bp insertion
// at 10bp/px, and the whole 10-99bp range at 20bp/px. `long` insertions never
// frequency-fade, so nothing downstream thinned the `small` one to compensate.
test('width never decreases as the insertion gets longer', () => {
  for (const pxPerBp of pxPerBps) {
    for (const featureHeight of featureHeights) {
      const widths = Array.from({ length: 200 }, (_, i) =>
        insertionBarWidth(i + 1, pxPerBp, featureHeight),
      )
      // Compared as a whole array so a failure prints the whole curve and the
      // length it turns over at, rather than one opaque pair.
      expect({ pxPerBp, featureHeight, widths }).toEqual({
        pxPerBp,
        featureHeight,
        widths: [...widths].sort((a, b) => a - b),
      })
    }
  }
})

test('small insertions are a 1px tick whatever the zoom', () => {
  for (const pxPerBp of pxPerBps) {
    expect(insertionBarWidth(LONG_INSERTION_MIN_LENGTH - 1, pxPerBp, 10)).toBe(
      1,
    )
  }
})

test('the long bar grows with the span and caps at 5px', () => {
  // 30bp at 0.2px/bp spans 6px, a third of which is 2px — between the floor and
  // the cap, so this is the branch's interior rather than either clamp.
  expect(insertionBarWidth(30, 0.2, 10)).toBeCloseTo(2, 4)
  // The 5px cap is only reachable in a row too short for the count label: past
  // 15px of span a tall row promotes the insertion to `large` and takes the
  // label width instead, so `insWPx/3` never gets to 5 there.
  expect(insertionBarWidth(90, 0.2, MIN_HEIGHT_FOR_TEXT - 1)).toBe(5)
  expect(insertionBarWidth(90, 0.2, MIN_HEIGHT_FOR_TEXT)).toBe(
    textWidthForNumber(90),
  )
})

test('a large insertion takes its count-label width, but only in a tall row', () => {
  // 100bp at 1px/bp is 100px wide — comfortably past the text threshold.
  expect(insertionBarWidth(100, 1, MIN_HEIGHT_FOR_TEXT)).toBe(
    textWidthForNumber(100),
  )
  // The same insertion in a row too short to draw the count falls back to the
  // long bar rather than leaving a wide empty box.
  expect(insertionBarWidth(100, 1, MIN_HEIGHT_FOR_TEXT - 1)).toBe(5)
})
