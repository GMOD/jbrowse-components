import {
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
  resolveSymlogConstant,
} from './normalize.ts'
import { getScale } from './scale.ts'
import { symlogTicks } from './symlogTicks.ts'

// What the axis has to be readable at all: d3's symlog ticks are evenly spaced
// across the SCORES while the plot places them by the transform, so on a
// [0, 1000] domain five of its six labels landed in the top quarter of the plot,
// inside a 10px label's own height of each other.

const spread = (domain: [number, number], ticks: number[]) => {
  const c = resolveSymlogConstant(domain[0], domain[1], 0)
  const normalize = makeScoreNormalizer(
    domain[0],
    domain[1],
    SCALE_TYPE_SYMLOG,
    c,
  )
  return ticks.map(v => normalize(v))
}

const closestPair = (positions: number[]) =>
  Math.min(
    ...positions
      .slice(1)
      .map((p, i) => Math.abs(p - positions[i]!))
      .concat(Infinity),
  )

describe('the labels are spread down the axis, not piled at the top', () => {
  test.each([
    [0, 1000],
    [0, 100],
    [0, 1],
    [0, 0.05],
    [-40, 60],
    [-1000, 1000],
  ] as [number, number][])('domain [%p, %p]', (min, max) => {
    const domain: [number, number] = [min, max]
    const ticks = getScale({
      domain,
      range: [200, 0],
      scaleType: 'symlog',
      nice: false,
    }).ticks(4)
    const positions = spread(domain, ticks)
    // 200px of plot, 10px of label: nothing closer than a label's own height
    expect(closestPair(positions) * 200).toBeGreaterThan(10)
    // and the axis is used, rather than one tick at each end and a gap
    expect(ticks.length).toBeGreaterThanOrEqual(4)
  })
})

test('both domain endpoints are labelled', () => {
  const domain: [number, number] = [0, 1000]
  const ticks = getScale({
    domain,
    range: [200, 0],
    scaleType: 'symlog',
    nice: false,
  }).ticks(4)
  expect(ticks[0]).toBe(0)
  expect(ticks.at(-1)).toBe(1000)
})

// The one score on a log-ratio track with an absolute meaning, and rounding
// never lands on it.
test('a domain crossing zero labels zero', () => {
  expect(symlogTicks([-40, 60], 0.06, 4)).toContain(0)
})

test('no value repeats, and none escapes the domain', () => {
  for (const [min, max] of [
    [0, 1000],
    [-40, 60],
    [0, 0.05],
    [-1e6, 3],
  ] as [number, number][]) {
    const ticks = symlogTicks([min, max], resolveSymlogConstant(min, max, 0), 4)
    expect(new Set(ticks).size).toBe(ticks.length)
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks)
    for (const v of ticks) {
      expect(v).toBeGreaterThanOrEqual(min)
      expect(v).toBeLessThanOrEqual(max)
    }
  }
})

test('the labels are numbers a person would have picked', () => {
  expect(symlogTicks([0, 1000], 1, 4)).toEqual([0, 5, 20, 200, 1000])
  expect(symlogTicks([0, 1], 0.001, 4)).toEqual([0, 0.005, 0.02, 0.2, 1])
})

// A descending domain reaches getScale through a maxScore bound under the data.
test('a descending domain comes back descending', () => {
  const ticks = symlogTicks([1000, 0], 1, 4)
  expect(ticks.at(0)).toBe(1000)
  expect(ticks.at(-1)).toBe(0)
})

describe('degenerate inputs fall back rather than producing NaN', () => {
  test('a flat domain', () => {
    expect(symlogTicks([5, 5], 1, 4)).toEqual([5])
  })
  test('a constant that is not positive', () => {
    for (const v of symlogTicks([0, 100], 0, 4)) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})
