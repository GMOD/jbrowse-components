import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '@jbrowse/wiggle-core'

import { lineLayers, makeSummaryLayers } from './wiggleLayers.ts'

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
    cuts: [0],
    innerColors: [],
    origin: 0,
    summaryScoreMode: 'whiskers',
  }

  test('line whiskers is a min-max band under the mean line', () => {
    const [band, mean, ...rest] = lineLayers(
      summaryData,
      'whiskers',
      posColor,
      negColor,
    )
    expect(rest).toEqual([])
    expect(band!.featureScores).toBe(maxScores)
    expect(band!.band!.minScores).toBe(minScores)
    expect(mean!.featureScores).toBe(scores)
    expect(mean!.band).toBeUndefined()
    for (const layer of [band!, mean!]) {
      expect(layer.color).toEqual(posColor)
      expect(layer.negColor).toEqual(negColor)
      expect(layer.colorsAbgr).toBeUndefined()
    }
  })

  test('line whiskers with no summary spread draws the mean alone', () => {
    const result = lineLayers(noSummaryData, 'whiskers', posColor, negColor)
    expect(result).toHaveLength(1)
    expect(result[0]!.band).toBeUndefined()
  })

  test.each([
    ['avg', scores],
    ['min', minScores],
    ['max', maxScores],
  ] as const)('a %s line is one layer over every bin', (mode, expected) => {
    const [line, ...rest] = lineLayers(summaryData, mode, posColor, negColor)
    expect(rest).toEqual([])
    expect(line!.featureScores).toBe(expected)
    expect(line!.numFeatures).toBe(2)
  })

  test('scatter whiskers keeps three whole bands, back to front', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      renderingType: RENDERING_TYPE_SCATTER,
    })
    expect(result.map(l => l.featureScores)).toEqual([
      minScores,
      scores,
      maxScores,
    ])
    expect(result.every(l => l.band === undefined)).toBe(true)
  })

  test('filled splits each band by sign, stacking each side back-to-front', () => {
    // pivot 6. Per band, values >= 6 go to the positive side, the rest to the
    // negative side. max [9,12] -> both pos; avg [5,8] -> 8 pos, 5 neg; min [2,4]
    // -> both neg. Positive side stacks max..avg..min (light at the back);
    // negative side reverses to min..avg..max.
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_XYPLOT,
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

  test('filled bands stack by the origin and colour by the pivot', () => {
    // origin 0, pivot 6: every value grows up from 0, so there is one stack
    // max..avg..min, and each bar takes pos or neg by its side of 6.
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 0,
      renderingType: RENDERING_TYPE_XYPLOT,
    })
    expect(result.map(l => [...l.featureScores])).toEqual([
      [9, 12],
      [5, 8],
      [2, 4],
    ])
    const abgr = (c: [number, number, number]) => normalizedRgbToABGR(...c)
    const light = (c: [number, number, number]) =>
      abgr(c.map(v => v + (1 - v) * 0.4) as [number, number, number])
    const dark = (c: [number, number, number]) =>
      abgr(c.map(v => v * 0.6) as [number, number, number])
    expect(result.map(l => [...l.colorsAbgr!])).toEqual([
      [light(posColor), light(posColor)],
      [abgr(negColor), abgr(posColor)],
      [dark(negColor), dark(negColor)],
    ])
  })

  test('each bar takes the colour of the band between two cuts it falls in', () => {
    const inner: [number, number, number] = [0.5, 0.5, 0.5]
    const [layer] = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      summaryScoreMode: 'avg',
      pivot: 4,
      origin: 0,
      cuts: [4, 6],
      innerColors: [inner],
      renderingType: RENDERING_TYPE_XYPLOT,
    })
    expect([...layer!.colorsAbgr!]).toEqual([
      normalizedRgbToABGR(...inner),
      normalizedRgbToABGR(...posColor),
    ])
  })

  test('density splits a lone band into solid sides', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      summaryScoreMode: 'min',
      pivot: 3,
      cuts: [3],
      innerColors: [],
      origin: 3,
      renderingType: RENDERING_TYPE_DENSITY,
    })
    expect(result.map(l => [...l.featureScores])).toEqual([[4], [2]])
    expect(result.every(l => l.colorsAbgr === undefined)).toBe(true)
  })

  test('returns single layer when no summary variation', () => {
    const result = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      renderingType: RENDERING_TYPE_SCATTER,
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
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
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
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
    })[0]!.colorsAbgr!
    const [below, above] = [avg[0]!, avg[1]!]
    // min [2, 4] is entirely below the pivot, max [9, 12] entirely above
    expect([...bandOnly('min')[0]!.colorsAbgr!]).toEqual([below, below])
    expect([...bandOnly('max')[0]!.colorsAbgr!]).toEqual([above, above])
  })

  test('colors each band per feature by sign vs pivot', () => {
    // pivot 6: avg [5,8] -> neg,pos (differ); max [9,12] -> pos,pos (same);
    // min [2,4] -> neg,neg (same).
    const [min, avg, max] = makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
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
    const [min, , max] = makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 100,
      cuts: [100],
      innerColors: [],
      origin: 100,
      renderingType: RENDERING_TYPE_SCATTER,
    })
    const red = (abgr: number | undefined) => (abgr ?? 0) & 0xff
    expect(red(min!.colorsAbgr?.[0])).toBeGreaterThan(red(max!.colorsAbgr?.[0]))
  })
})
