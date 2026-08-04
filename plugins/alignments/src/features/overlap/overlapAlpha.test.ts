import { overlapAlpha } from '../../LinearAlignmentsDisplay/shaders/slang/overlap.js.generated.ts'

// Retirement gate for the overlap tint's Canvas2D twin (adr-051). drawCanvas.ts
// multiplied the exported OVERLAP_ALPHA by its own hand-written `smoothstep`
// over the two exported fade bounds — the constants were shared, the curve
// between them was not.

// The retired spelling, verbatim.
function retiredSmoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
function retiredOverlapAlpha(w: number) {
  return 0.4 * retiredSmoothstep(1.5, 12, w)
}

test('matches the hand-written twin it replaced', () => {
  // Tenth-pixel steps across the whole fade and past both ends: overlaps really
  // do span this range, since the width is a genomic interval at whatever the
  // current zoom is.
  for (let i = 0; i <= 200; i++) {
    const w = i * 0.1
    expect(overlapAlpha(w)).toBeCloseTo(retiredOverlapAlpha(w), 7)
  }
})

test('the fade endpoints the draw gate depends on', () => {
  // At or below the low bound the tint is fully gone, which is what lets
  // drawCanvas skip the fillRect entirely rather than painting a no-op.
  expect(overlapAlpha(0)).toBe(0)
  expect(overlapAlpha(1.5)).toBe(0)
  // Full strength from the high bound up — a wide, zoomed-in overlap is meant
  // to read clearly, and must not keep brightening past it.
  expect(overlapAlpha(12)).toBeCloseTo(0.4, 7)
  expect(overlapAlpha(1000)).toBeCloseTo(0.4, 7)
  // Monotonic in between, so widening an overlap never makes it fainter.
  for (let i = 0; i < 20; i++) {
    expect(overlapAlpha(i * 0.75)).toBeLessThanOrEqual(
      overlapAlpha((i + 1) * 0.75),
    )
  }
})
