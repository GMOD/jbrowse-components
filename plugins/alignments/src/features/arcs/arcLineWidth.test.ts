import { ARC_WIDTH_MAX_SCALE, arcLineWidth } from './arcLineWidth.ts'

describe('arcLineWidth', () => {
  // The guarantee that makes coalescing safe to turn on everywhere: a feed
  // with no repeats paints exactly what it painted before.
  test('support 1 is the configured width, exactly', () => {
    expect(arcLineWidth(1, 2)).toBe(2)
    expect(arcLineWidth(1, 3.5)).toBe(3.5)
  })

  test('each doubling adds the same amount of width', () => {
    const base = 2
    const step = arcLineWidth(2, base) - arcLineWidth(1, base)
    expect(arcLineWidth(4, base) - arcLineWidth(2, base)).toBeCloseTo(step)
    expect(arcLineWidth(8, base) - arcLineWidth(4, base)).toBeCloseTo(step)
  })

  test('a deep pileup is capped rather than drawing a band', () => {
    expect(arcLineWidth(100_000, 2)).toBe(2 * ARC_WIDTH_MAX_SCALE)
  })

  // Support is a count and cannot be 0, but the arrays are Uint32 and a bug
  // upstream would read as one — a zero must not invert the curve.
  test('a degenerate support does not shrink the arc', () => {
    expect(arcLineWidth(0, 2)).toBe(2)
  })
})
