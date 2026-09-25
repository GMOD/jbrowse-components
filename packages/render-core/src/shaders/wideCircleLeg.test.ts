import { wideCircleLeg } from './curveDistance.js.generated.ts'
import { LINK_CURVE_SEGMENTS } from './linkMark.consts.generated.ts'

const SWEEP = 0.3

function legs(segments: number) {
  const right: number[] = []
  const left: number[] = []
  for (let seg = 0; seg <= segments; seg++) {
    const [side, b] = wideCircleLeg(seg, segments, SWEEP)
    ;(side > 0 ? right : left).push(b)
  }
  return { right, left }
}

test.each([LINK_CURVE_SEGMENTS, 8, 4])(
  'both legs of a %i-segment strip rise from the foot to the full sweep',
  segments => {
    const { right, left } = legs(segments)
    expect(right[0]).toBe(0)
    expect(left.at(-1)).toBe(0)
    expect(Math.max(...right)).toBeCloseTo(SWEEP, 12)
    expect(Math.max(...left)).toBeCloseTo(SWEEP, 12)
  },
)

test('each leg is monotonic from its foot, the left one mirrored', () => {
  const { right, left } = legs(LINK_CURVE_SEGMENTS)
  for (let i = 1; i < right.length; i++) {
    expect(right[i]).toBeGreaterThan(right[i - 1]!)
  }
  for (let i = 1; i < left.length; i++) {
    expect(left[i]).toBeLessThan(left[i - 1]!)
  }
})
