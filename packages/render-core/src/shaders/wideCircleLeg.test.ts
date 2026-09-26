import {
  wideCircleLeg,
  wideCircleLegStep,
} from './curveDistance.js.generated.ts'
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

// Odd counts included: the left leg is spread over `segments - half - 1`, and
// spelling that `half - 1` instead overshoots the sweep on every odd strip
// (65 segments reached 1.032x it) and divides by zero at 3.
test.each([LINK_CURVE_SEGMENTS, 8, 7, 6, 5, 4, 3])(
  'both legs of a %i-segment strip rise from the foot to the full sweep',
  segments => {
    const { right, left } = legs(segments)
    expect(right[0]).toBe(0)
    expect(left.at(-1)).toBe(0)
    expect(Math.max(...right)).toBeCloseTo(SWEEP, 12)
    expect(Math.max(...left)).toBeCloseTo(SWEEP, 12)
    // And NO further: the hull is padded for `legSweep`, so a leg running past
    // it leaves the band through a chord nothing sized.
    expect(Math.max(...right, ...left)).toBeLessThanOrEqual(SWEEP)
  },
)

// Reaching the sweep is half the contract; arriving in equal steps is the other
// half, and it is the load-bearing one. `legSweepAngle` exists so that every
// chord's sagitta stays under a pixel across the band — a leg that front-loads
// its segments near the foot satisfies every endpoint assertion above and
// leaves one huge chord at the band edge, which is the taper the whole sweep
// rule was written to kill.
test.each([LINK_CURVE_SEGMENTS, 8, 7, 4, 3])(
  'a %i-segment strip steps each leg by a constant angle',
  segments => {
    const { right, left } = legs(segments)
    for (const leg of [right, [...left].reverse()]) {
      const steps = leg.slice(1).map((b, i) => b - leg[i]!)
      for (const step of steps) {
        expect(step).toBeCloseTo(steps[0]!, 12)
      }
    }
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

// The hull circumscribes each chord by half this step, so a step read off the
// wrong leg leaves the other leg's chords sagging.
test.each([LINK_CURVE_SEGMENTS, 8, 7, 4, 3])(
  'wideCircleLegStep is the step of the leg a %i-segment strip puts seg on',
  segments => {
    for (let seg = 0; seg < segments; seg++) {
      const [side, b] = wideCircleLeg(seg, segments, SWEEP)
      const [nextSide, next] = wideCircleLeg(seg + 1, segments, SWEEP)
      if (side === nextSide) {
        expect(wideCircleLegStep(seg, segments, SWEEP)).toBeCloseTo(
          Math.abs(next - b),
          12,
        )
        expect(wideCircleLegStep(seg + 1, segments, SWEEP)).toBeCloseTo(
          Math.abs(next - b),
          12,
        )
      }
    }
  },
)
