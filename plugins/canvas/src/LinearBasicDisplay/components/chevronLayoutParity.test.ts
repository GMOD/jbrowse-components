import {
  chevronCount,
  chevronOffset,
  showChevrons,
} from '../passes/shaders/chevron.js.generated.ts'
import { CHEVRON_SPACING_PX } from './sharedRendererConstants.ts'

function retiredShowChevrons(lineWidthPx: number) {
  return lineWidthPx >= CHEVRON_SPACING_PX * 0.5
}

function retiredCount(lineWidthPx: number) {
  return Math.max(1, Math.floor(lineWidthPx / CHEVRON_SPACING_PX))
}

function retiredCx(lineWidthPx: number, total: number, c: number) {
  const spacing = lineWidthPx / (total + 1)
  return spacing * (c + 1)
}

// Either side of the show/hide threshold and the first count steps: both are
// floors, and a half-open comparison is what flips silently.
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
  // The gate is half the spacing, so without the `max(1, …)` a 20-39px line
  // floors to zero chevrons and draws a bare intron line.
  expect(chevronCount(20)).toBe(1)
  expect(chevronCount(39.9)).toBe(1)
  expect(chevronCount(40)).toBe(1)
  expect(chevronCount(80)).toBe(2)
})

test('chevrons sit in N+1 gaps, so neither end is flush', () => {
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
  const total = chevronCount(400)
  for (let c = 0; c < total; c++) {
    expect(chevronOffset(4000, total, c)).toBeCloseTo(
      chevronOffset(400, total, c) * 10,
      9,
    )
  }
})
