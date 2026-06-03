import { makeOverviewTicks, makeTicks } from './util.ts'

// overviewScale=5000 → chooseGridPitch gives majorPitch=1_000_000
const SCALE = 5000

describe('makeOverviewTicks', () => {
  test('forward from start=0 lands on neat multiples', () => {
    const ticks = makeOverviewTicks(0, 10_000_000, SCALE, false)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000,
      6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ])
  })

  test('forward from non-zero start still lands on neat multiples', () => {
    const ticks = makeOverviewTicks(123_456, 10_000_000, SCALE, false)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000,
      6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ])
  })

  test('forward offsetPx is relative to block start, not 0', () => {
    const ticks = makeOverviewTicks(123_456, 10_000_000, SCALE, false)
    // first tick at 1_000_000 is (1_000_000 - 123_456) / 5000 px from left edge
    expect(ticks[0]!.offsetPx).toBeCloseTo((1_000_000 - 123_456) / SCALE)
  })

  test('reversed from end=10M lands on neat multiples', () => {
    const ticks = makeOverviewTicks(0, 10_000_000, SCALE, true)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      9_000_000, 8_000_000, 7_000_000, 6_000_000, 5_000_000,
      4_000_000, 3_000_000, 2_000_000, 1_000_000,
    ])
  })

  test('reversed with non-zero start includes all neat multiples above start', () => {
    // start=500_000: tick at 1_000_000 should be included (> start)
    const ticks = makeOverviewTicks(500_000, 10_000_000, SCALE, true)
    expect(ticks.map(t => t.genomicCoord)).toEqual([
      9_000_000, 8_000_000, 7_000_000, 6_000_000, 5_000_000,
      4_000_000, 3_000_000, 2_000_000, 1_000_000,
    ])
  })

  test('returns empty array when no pitch multiple fits inside block', () => {
    // block narrower than one majorPitch with no multiple inside
    const ticks = makeOverviewTicks(1_100_000, 1_900_000, SCALE, false)
    expect(ticks).toEqual([])
  })
})

describe('tick calculation', () => {
  test('one', () => {
    const result = Array.from(makeTicks(0, 10, 0.05))
    expect(result).toEqual([
      { type: 'major', base: -1, index: 0 },
      { type: 'minor', base: 0, index: 1 },
      { type: 'minor', base: 1, index: 2 },
      { type: 'minor', base: 2, index: 3 },
      { type: 'minor', base: 3, index: 4 },
      { type: 'minor', base: 4, index: 5 },
      { type: 'minor', base: 5, index: 6 },
      { type: 'minor', base: 6, index: 7 },
      { type: 'minor', base: 7, index: 8 },
      { type: 'minor', base: 8, index: 9 },
      { type: 'major', base: 9, index: 10 },
      { type: 'minor', base: 10, index: 11 },
      { type: 'minor', base: 11, index: 12 },
    ])
  })
  test('two', () => {
    const result = Array.from(makeTicks(0, 50, 1))
    expect(result).toEqual([
      { type: 'minor', base: -21, index: 0 },
      { type: 'major', base: -1, index: 1 },
      { type: 'minor', base: 19, index: 2 },
      { type: 'minor', base: 39, index: 3 },
      { type: 'minor', base: 59, index: 4 },
      { type: 'minor', base: 79, index: 5 },
    ])
  })
})
