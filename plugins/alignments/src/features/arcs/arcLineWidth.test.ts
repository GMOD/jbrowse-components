import {
  ARC_WIDTH_MAX_SCALE,
  ARC_WIDTH_PER_DOUBLING,
  arcLineWidth,
} from './arcLineWidth.ts'

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

  // Where the cap starts binding is DERIVED from the two constants, not chosen,
  // so it is the thing to state and the thing to pin: the comment on
  // ARC_WIDTH_MAX_SCALE claimed 128 reads for a while, which is the width at
  // 128 (4.85x) mistaken for the support the ceiling is reached at.
  test('the ceiling binds at the support the two constants imply', () => {
    const crossover = 2 ** ((ARC_WIDTH_MAX_SCALE - 1) / ARC_WIDTH_PER_DOUBLING)
    expect(crossover).toBeCloseTo(43.9, 1)
    // One read short of it still rises; one past it is already flat.
    expect(arcLineWidth(Math.floor(crossover), 2)).toBeLessThan(
      2 * ARC_WIDTH_MAX_SCALE,
    )
    expect(arcLineWidth(Math.ceil(crossover), 2)).toBe(2 * ARC_WIDTH_MAX_SCALE)
  })

  // Support is a count and cannot be 0, but the arrays are Uint32 and a bug
  // upstream would read as one — a zero must not invert the curve.
  test('a degenerate support does not shrink the arc', () => {
    expect(arcLineWidth(0, 2)).toBe(2)
  })
})
