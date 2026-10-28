import { edgeCoverage, strokeCoverage } from './antialias.js.generated.ts'

// Exact area of a pixel `[d - aa/2, d + aa/2]` that a stroke `[-h, h]` covers,
// over the pixel's width.
function exact(h: number, d: number, dpr: number) {
  const aa = 1 / dpr
  const lo = Math.max(-h, d - aa / 2)
  const hi = Math.min(h, d + aa / 2)
  return Math.max(0, hi - lo) / aa
}

test.each([1, 2])('a sub-pixel stroke inks its true width at dpr %d', dpr => {
  for (const widthPx of [0.1, 0.25, 0.5, 0.75 / dpr]) {
    for (const d of [0, 0.1, 0.3, 0.6]) {
      expect(strokeCoverage(widthPx / 2, d, dpr)).toBeCloseTo(
        exact(widthPx / 2, d, dpr),
        6,
      )
    }
  }
  expect(strokeCoverage(0.25, 0, 1)).toBe(0.5)
})

test('a stroke a pixel or wider is the single edge ramp', () => {
  for (const dpr of [1, 2]) {
    for (const h of [0.5 / dpr, 1, 3]) {
      for (const d of [0, 0.2, h, h + 0.2, h + 1]) {
        expect(strokeCoverage(h, d, dpr)).toBe(edgeCoverage(h - d, dpr))
      }
    }
  }
})
