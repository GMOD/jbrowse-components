import { aaPx, strokeCoverage } from './antialias.js.generated.ts'

// Exact area of a pixel `[d - aa/2, d + aa/2]` that a stroke `[-h, h]` covers,
// over the pixel's width.
function exact(h: number, d: number, dpr: number) {
  const aa = 1 / dpr
  const lo = Math.max(-h, d - aa / 2)
  const hi = Math.min(h, d + aa / 2)
  return Math.max(0, hi - lo) / aa
}

function edgeRamp(signedInk: number, dpr: number) {
  return Math.min(1, Math.max(0, signedInk * dpr + 0.5))
}

test.each([0.5, 0.8])(
  'a sub-pixel stroke inks its true width at dpr %d',
  dpr => {
    for (const widthPx of [0.1, 0.25, 0.5, 0.75 / dpr]) {
      for (const d of [0, 0.1, 0.3, 0.6]) {
        expect(strokeCoverage(widthPx / 2, d, dpr)).toBeCloseTo(
          exact(widthPx / 2, d, dpr),
          6,
        )
      }
    }
  },
)

test.each([0.5, 0.8])(
  'a stroke an output pixel or wider is one edge ramp at dpr %d',
  dpr => {
    for (const h of [0.5 / dpr, 1.5, 3]) {
      for (const d of [0, 0.2, h, h + 0.2, h + 1]) {
        expect(strokeCoverage(h, d, dpr)).toBeCloseTo(edgeRamp(h - d, dpr), 6)
      }
    }
  },
)

test('a zero or negative ratio ramps as the furthest a browser zooms out', () => {
  for (const dpr of [0.25, 0.1, 0, -1]) {
    expect(aaPx(dpr)).toBe(4)
  }
})
