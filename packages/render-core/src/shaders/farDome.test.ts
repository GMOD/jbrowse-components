import { ellipseNearest } from '../marks/ellipseDistance.ts'
import {
  farDomeDistancePx,
  farDomeParam,
} from './curveDistance.js.generated.ts'

// A far dome is an ellipse thousands to millions of px wide and tens tall. The
// fragment measures to it from one of its feet (`farDomeDistancePx`), where
// nothing cancels, and these hold that to the exact ellipse distance at the
// widths a far pair reaches and the strokes a link draws, over the half of the
// dome nearer the foot it measures from, which is the half the shader asks of
// it. Under the baseline the stroke is still the rising half's, where the exact
// solve would answer with the mirrored half, so the referee there is the foot
// or the level point, whichever is nearer.

// A point `offPx` along the dome's outward normal from its point at angle `b`
// from the left foot: inward of that foot by `d` and up by `h`.
function probe(rx: number, ry: number, b: number, offPx: number) {
  const nx = -Math.cos(b) * ry
  const ny = Math.sin(b) * rx
  const len = Math.hypot(nx, ny)
  return {
    d: 2 * rx * Math.sin(b / 2) ** 2 + (nx / len) * offPx,
    h: ry * Math.sin(b) + (ny / len) * offPx,
  }
}

describe('farDomeDistancePx', () => {
  const domes: [number, number][] = [
    [3000, 40],
    [3000, 300],
    [100_000, 40],
    [1_000_000, 40],
    [1_000_000, 90],
    [10_000_000, 90],
  ]
  const angles = [
    0.0005,
    0.002,
    0.01,
    0.05,
    0.2,
    0.6,
    1,
    1.4,
    Math.PI / 2,
    1.7,
    1.9,
  ]
  const offsets = [-8, -4, -1.5, -0.5, 0, 0.5, 1.5, 4, 8]

  test.each(domes)('rx %d, ry %d agrees with the ellipse', (rx, ry) => {
    let worst = 0
    for (const b of angles) {
      for (const off of offsets) {
        const { d, h } = probe(rx, ry, b, off)
        if (h >= 0) {
          const exact = ellipseNearest(d - rx, -h, rx, ry).dist
          worst = Math.max(
            worst,
            Math.abs(farDomeDistancePx(d, h, rx, ry) - exact),
          )
        }
      }
    }
    // the worst is inside a foot, a tip sharper than a px, where no step
    // lands nearer than the start
    expect(worst).toBeLessThan(0.05)
  })

  test.each(domes)(
    'rx %d, ry %d measures to the rising half from under the baseline',
    (rx, ry) => {
      for (const d of [-3, 0, 0.5, 3, 40, 900]) {
        for (const h of [-0.5, -2, -5]) {
          let exact = Math.hypot(d, h)
          for (let k = 1; k <= 20_000; k++) {
            const x = (k / 20_000) * Math.max(4 * d, 40)
            const y = ry * Math.sqrt(Math.max(1 - (1 - x / rx) ** 2, 0))
            exact = Math.min(exact, Math.hypot(d - x, h - y))
          }
          // the hull hands the fragment nothing further off than its pad
          if (exact < 10) {
            expect(
              Math.abs(farDomeDistancePx(d, h, rx, ry) - exact),
            ).toBeLessThan(0.05)
          }
        }
      }
    },
  )

  it('measures to the foot from outside the pair', () => {
    expect(farDomeDistancePx(-5, 0, 1_000_000, 40)).toBeCloseTo(5)
  })

  it('is the height short of the apex in the middle of the pair', () => {
    expect(farDomeDistancePx(1_000_000, 37, 1_000_000, 40)).toBeCloseTo(3)
    expect(farDomeDistancePx(1_000_500, 44, 1_000_000, 40)).toBeCloseTo(4)
  })
})

describe('farDomeParam', () => {
  it('is sin(b / 2) where the dome is that far inward of its foot', () => {
    for (const rx of [3000, 1_000_000]) {
      for (const b of [0.001, 0.3, 1.2, Math.PI / 2, 2.2]) {
        const d = 2 * rx * Math.sin(b / 2) ** 2
        expect(farDomeParam(d, rx)).toBeCloseTo(Math.sin(b / 2), 6)
      }
    }
  })

  it('holds at the foot outside the pair and short of the far foot', () => {
    expect(farDomeParam(-50, 3000)).toBe(0)
    expect(farDomeParam(7000, 3000)).toBeCloseTo(Math.sqrt(0.84))
  })
})
