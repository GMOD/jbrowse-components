import { makeSummaryLayers } from './wiggleLayers.ts'

describe('makeSummaryLayers', () => {
  const positions = new Uint32Array([0, 10, 10, 20])
  const scores = new Float32Array([5, 8])
  const minScores = new Float32Array([2, 4])
  const maxScores = new Float32Array([9, 12])
  const posColor: [number, number, number] = [0.2, 0.4, 0.8]
  const negColor: [number, number, number] = [0.9, 0.2, 0.2]

  const summaryData = {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: minScores,
    featureMaxScores: maxScores,
    numFeatures: 2,
    hasSummaryScores: true,
  }

  const noSummaryData = {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: scores,
    featureMaxScores: scores,
    numFeatures: 2,
    hasSummaryScores: false,
  }

  const base = {
    posColor,
    negColor,
    pivot: 0,
    isFilled: false,
    summaryScoreMode: 'whiskers',
    isDensityMode: false,
  }

  test('returns 3 layers (max, avg, min) when summary data present', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      isScatter: false,
    })
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(maxScores)
    expect(result[1]!.featureScores).toBe(scores)
    expect(result[2]!.featureScores).toBe(minScores)
  })

  test('filled splits each band by sign, stacking each side back-to-front', () => {
    // pivot 6. Per band, values >= 6 go to the positive side, the rest to the
    // negative side. max [9,12] -> both pos; avg [5,8] -> 8 pos, 5 neg; min [2,4]
    // -> both neg. Positive side stacks max..avg..min (light at the back);
    // negative side reverses to min..avg..max.
    const result = makeSummaryLayers({
      data: summaryData,
      posColor,
      negColor,
      pivot: 6,
      isScatter: false,
      isFilled: true,
      summaryScoreMode: 'whiskers',
      isDensityMode: false,
    })
    // no per-instance colors: each split layer is a single solid color
    expect(result.every(l => l.colorsAbgr === undefined)).toBe(true)
    expect(result.map(l => [...l.featureScores])).toEqual([
      [9, 12], // pos max
      [8], // pos avg
      // pos min empty (both below pivot) -> dropped
      [2, 4], // neg min (deepest, back)
      [5], // neg avg
      // neg max empty (both above pivot) -> dropped
    ])
  })

  test('returns single layer when no summary variation', () => {
    const result = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      isScatter: false,
    })
    expect(result).toHaveLength(1)
  })

  // min/max are the one-band case of the same machinery: the band the user
  // picked, colored by its own sign.
  const bandOnly = (summaryScoreMode: string) =>
    makeSummaryLayers({
      data: summaryData,
      ...base,
      summaryScoreMode,
      pivot: 6,
      isScatter: false,
    })

  test.each([
    ['min', minScores],
    ['max', maxScores],
  ] as const)('%s mode draws that band alone', (mode, expected) => {
    const layers = bandOnly(mode)
    expect(layers).toHaveLength(1)
    expect(layers[0]!.featureScores).toBe(expected)
  })

  // Untinted: with no sibling band there is no magnitude relationship for a
  // tint to carry, so the two colors are plain posColor/negColor — the very
  // ones a whiskers render's avg band uses.
  test('the min/max band is untinted', () => {
    // noSummaryData collapses to the avg band alone; its scores [5, 8] straddle
    // pivot 6, so it yields both untinted colors in one layer.
    const avg = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      pivot: 6,
      isScatter: false,
    })[0]!.colorsAbgr!
    const [below, above] = [avg[0]!, avg[1]!]
    // min [2, 4] is entirely below the pivot, max [9, 12] entirely above
    expect([...bandOnly('min')[0]!.colorsAbgr!]).toEqual([below, below])
    expect([...bandOnly('max')[0]!.colorsAbgr!]).toEqual([above, above])
  })

  test('reverses order in scatter mode', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      isScatter: true,
    })
    expect(result).toHaveLength(3)
    expect(result[0]!.featureScores).toBe(minScores)
    expect(result[2]!.featureScores).toBe(maxScores)
  })

  test('colors each band per feature by sign vs pivot', () => {
    // pivot 6: avg [5,8] -> neg,pos (differ); max [9,12] -> pos,pos (same);
    // min [2,4] -> neg,neg (same).
    const [max, avg, min] = makeSummaryLayers({
      data: summaryData,
      posColor,
      negColor,
      pivot: 6,
      isScatter: false,
      isFilled: false,
      summaryScoreMode: 'whiskers',
      isDensityMode: false,
    })
    expect(avg!.colorsAbgr).toHaveLength(2)
    expect(avg!.colorsAbgr![0]).not.toBe(avg!.colorsAbgr![1]) // neg vs pos
    expect(max!.colorsAbgr![0]).toBe(max!.colorsAbgr![1]) // both pos
    expect(min!.colorsAbgr![0]).toBe(min!.colorsAbgr![1]) // both neg
    // the max band's pos color is a lightened variant of the avg band's pos
    expect(max!.colorsAbgr![0]).not.toBe(avg!.colorsAbgr![1])
    // below-pivot avg color equals the min band's (both plain neg, but min is
    // darkened) — so they must differ by the tint
    expect(min!.colorsAbgr![0]).not.toBe(avg!.colorsAbgr![0])
  })

  test('negative bands mirror the tint: most-negative min band is lightest', () => {
    // pivot 100: every band is below the pivot, so all features use negColor.
    // The min band (most negative) must be lighter than the max band (least
    // negative) — the inverse of the positive side, so magnitude reads as
    // lightness in both directions rather than dark-brown negatives.
    const [max, , min] = makeSummaryLayers({
      data: summaryData,
      posColor,
      negColor,
      pivot: 100,
      isScatter: false,
      isFilled: false,
      summaryScoreMode: 'whiskers',
      isDensityMode: false,
    })
    const red = (abgr: number | undefined) => (abgr ?? 0) & 0xff
    expect(red(min!.colorsAbgr?.[0])).toBeGreaterThan(red(max!.colorsAbgr?.[0]))
  })
})
