import {
  chevronCount,
  chevronOffset,
  showChevrons,
} from '../passes/shaders/chevron.js.generated.ts'
import { CHEVRON_SPACING_PX } from './sharedRendererConstants.ts'

// The retirement gate for chevron.slang's `//! js-export` (adr-051).
//
// This one came from a different place than the rest of the export set: the
// decisions were not in a shader FUNCTION, they were inline in `vs_main`, so
// nothing that inventories functions could see them. `drawLines` in
// Canvas2DFeatureRenderer carried the second copy, comment-synced.
//
// The retired arithmetic is below verbatim, in the px units Canvas2D used. The
// shader ran the identical formulas in bp, which is exactly why a drift here
// would have been invisible: the two spellings do not even look alike.

function retiredShowChevrons(lineWidthPx: number) {
  return lineWidthPx >= CHEVRON_SPACING_PX * 0.5
}

function retiredCount(lineWidthPx: number) {
  return Math.max(1, Math.floor(lineWidthPx / CHEVRON_SPACING_PX))
}

function retiredCx(lineWidthPx: number, total: number, c: number) {
  // N chevrons with gaps at both ends ⇒ N+1 evenly-sized gaps.
  const spacing = lineWidthPx / (total + 1)
  return spacing * (c + 1)
}

// Widths either side of the show/hide threshold (20px) and the first few count
// steps (40, 80, 120), since both are floors and a half-open comparison is the
// thing that flips silently.
const WIDTHS = [
  0, 1, 19.9, 20, 20.1, 39.9, 40, 40.1, 79.9, 80, 80.1, 119.9, 120, 400, 1e6,
]

test('showChevrons matches the twin it replaced', () => {
  for (const w of WIDTHS) {
    expect(showChevrons(w)).toBe(retiredShowChevrons(w))
  }
})

test('chevronCount matches the twin it replaced', () => {
  for (const w of WIDTHS.filter(w => retiredShowChevrons(w))) {
    expect(chevronCount(w)).toBe(retiredCount(w))
  }
})

test('chevronOffset matches the twin it replaced', () => {
  for (const w of WIDTHS.filter(w => retiredShowChevrons(w))) {
    const total = chevronCount(w)
    for (let c = 0; c < Math.min(total, 50); c++) {
      expect(chevronOffset(w, total, c)).toBeCloseTo(retiredCx(w, total, c), 9)
    }
  }
})

test('a line that clears the gate always gets at least one chevron', () => {
  // The `max(1, …)` exists because the gate is half the spacing: a 20-39px line
  // floors to zero chevrons and would draw a bare intron line with no strand
  // marking at all.
  expect(chevronCount(20)).toBe(1)
  expect(chevronCount(39.9)).toBe(1)
  expect(chevronCount(40)).toBe(1)
  expect(chevronCount(80)).toBe(2)
})

test('chevrons sit in N+1 gaps, so neither end is flush', () => {
  // The property both `+1`s exist for, asserted on the layout rather than on
  // the formula: with N marks the gaps before the first, between each, and
  // after the last are all equal.
  for (const total of [1, 2, 5]) {
    const span = 400
    const gaps = [
      chevronOffset(span, total, 0),
      ...Array.from(
        { length: total - 1 },
        (_, i) =>
          chevronOffset(span, total, i + 1) - chevronOffset(span, total, i),
      ),
      span - chevronOffset(span, total, total - 1),
    ]
    for (const g of gaps) {
      expect(g).toBeCloseTo(span / (total + 1), 9)
    }
  }
})

test('the layout is unit-agnostic, which is what lets bp and px share it', () => {
  // The shader lays chevrons out in bp and Canvas2D in px. Scaling the span
  // scales every offset by the same factor — if it did not, the two backends
  // would put the marks in different places on the same line.
  const total = chevronCount(400)
  for (let c = 0; c < total; c++) {
    expect(chevronOffset(4000, total, c)).toBeCloseTo(
      chevronOffset(400, total, c) * 10,
      9,
    )
  }
})
