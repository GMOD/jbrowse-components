import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '@jbrowse/wiggle-core'

import { lineLayers, makeSummaryLayers } from './wiggleLayers.ts'

import type { WiggleRenderingType } from '@jbrowse/wiggle-core'

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
    summaryField: 'score',
    extent: 'min-max',
    gradient: false,
  }

  test('a min-max line is a band under the mean line', () => {
    const [band, mean, ...rest] = lineLayers(
      summaryData,
      'score',
      'min-max',
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

  test('a min-max line with no summary spread draws the mean alone', () => {
    const result = lineLayers(
      noSummaryData,
      'score',
      'min-max',
      posColor,
      negColor,
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.band).toBeUndefined()
  })

  test.each([
    ['score', scores],
    ['minScore', minScores],
    ['maxScore', maxScores],
  ] as const)('a %s line is one layer over every bin', (mode, expected) => {
    const [line, ...rest] = lineLayers(
      summaryData,
      mode,
      'none',
      posColor,
      negColor,
    )
    expect(rest).toEqual([])
    expect(line!.featureScores).toBe(expected)
    expect(line!.numFeatures).toBe(2)
  })

  test('a max line keeps its min-max band, the line on its upper edge', () => {
    const [band, line] = lineLayers(
      summaryData,
      'maxScore',
      'min-max',
      posColor,
      negColor,
    )
    expect(band!.band!.minScores).toBe(minScores)
    expect(line!.featureScores).toBe(maxScores)
  })

  test('scatter min-max keeps three whole bands, back to front', () => {
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
    // negative side. max [9,12] -> both pos; mean [5,8] -> 8 pos, 5 neg; min [2,4]
    // -> both neg. Positive side stacks max..mean..min (light at the back);
    // negative side reverses to min..mean..max.
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
      [8], // pos mean
      // pos min empty (both below pivot) -> dropped
      [2, 4], // neg min (deepest, back)
      [5], // neg mean
      // neg max empty (both above pivot) -> dropped
    ])
  })

  test('filled bands stack by the origin and color by the pivot', () => {
    // origin 0, pivot 6: every value grows up from 0, so there is one stack
    // max..mean..min, and each bar takes pos or neg by its side of 6.
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

  test('each bar takes the color of the band between two cuts it falls in', () => {
    const inner: [number, number, number] = [0.5, 0.5, 0.5]
    const [layer] = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      extent: 'none',
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

  test('a float32 score on a cut is at the cut, as the shader compares', () => {
    const atCut = new Float32Array([0.7, 0.5])
    const data = {
      ...noSummaryData,
      featureScores: atCut,
      featureMinScores: atCut,
      featureMaxScores: atCut,
    }
    const opts = { data, ...base, extent: 'none', pivot: 0.7, cuts: [0.7] }
    const [bars] = makeSummaryLayers({
      ...opts,
      renderingType: RENDERING_TYPE_XYPLOT,
    })
    expect([...bars!.colorsAbgr!]).toEqual([
      normalizedRgbToABGR(...posColor),
      normalizedRgbToABGR(...negColor),
    ])
    const density = makeSummaryLayers({
      ...opts,
      renderingType: RENDERING_TYPE_DENSITY,
    })
    expect(density.map(l => [l.color, [...l.featureScores]])).toEqual([
      [posColor, [atCut[0]]],
      [negColor, [0.5]],
    ])
  })

  test('density splits a lone band into solid sides', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      summaryField: 'minScore',
      extent: 'none',
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
  const bandOnly = (summaryField: string) =>
    makeSummaryLayers({
      data: summaryData,
      ...base,
      summaryField,
      extent: 'none',
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
    })

  test.each([
    ['minScore', minScores],
    ['maxScore', maxScores],
  ] as const)('%s mode draws that band alone', (mode, expected) => {
    const layers = bandOnly(mode)
    expect(layers).toHaveLength(1)
    expect(layers[0]!.featureScores).toBe(expected)
  })

  // Untinted: with no sibling band there is no magnitude relationship for a
  // tint to carry, so the two colors are plain posColor/negColor — the very
  // ones a min-max render's mean band uses.
  test('the min/max band is untinted', () => {
    // noSummaryData collapses to the mean band alone; its scores [5, 8] straddle
    // pivot 6, so it yields both untinted colors in one layer.
    const mean = makeSummaryLayers({
      data: noSummaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
    })[0]!.colorsAbgr!
    const [below, above] = [mean[0]!, mean[1]!]
    // min [2, 4] is entirely below the pivot, max [9, 12] entirely above
    expect([...bandOnly('minScore')[0]!.colorsAbgr!]).toEqual([below, below])
    expect([...bandOnly('maxScore')[0]!.colorsAbgr!]).toEqual([above, above])
  })

  test('colors each band per feature by sign vs pivot', () => {
    // pivot 6: mean [5,8] -> neg,pos (differ); max [9,12] -> pos,pos (same);
    // min [2,4] -> neg,neg (same).
    const [min, mean, max] = makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      innerColors: [],
      origin: 6,
      renderingType: RENDERING_TYPE_SCATTER,
    })
    expect(mean!.colorsAbgr).toHaveLength(2)
    expect(mean!.colorsAbgr![0]).not.toBe(mean!.colorsAbgr![1]) // neg vs pos
    expect(max!.colorsAbgr![0]).toBe(max!.colorsAbgr![1]) // both pos
    expect(min!.colorsAbgr![0]).toBe(min!.colorsAbgr![1]) // both neg
    // the max band's pos color is a lightened variant of the mean band's pos
    expect(max!.colorsAbgr![0]).not.toBe(mean!.colorsAbgr![1])
    // below-pivot mean color equals the min band's (both plain neg, but min is
    // darkened) — so they must differ by the tint
    expect(min!.colorsAbgr![0]).not.toBe(mean!.colorsAbgr![0])
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

  // pivot 6 with origin 0: without a gradient these bars part by color at 6
  // and the min-max bands tint.
  const gradientLayers = (renderingType: WiggleRenderingType) =>
    makeSummaryLayers({
      data: summaryData,
      ...base,
      pivot: 6,
      cuts: [6],
      renderingType,
      gradient: true,
    })

  test('gradient bars stack by the origin and carry no color of their own', () => {
    const result = gradientLayers(RENDERING_TYPE_XYPLOT)
    expect(result.map(l => l.featureScores)).toEqual([
      maxScores,
      scores,
      minScores,
    ])
    for (const layer of result) {
      expect(layer.colorsAbgr).toBeUndefined()
      expect(layer.color).toEqual(posColor)
    }
  })

  test('gradient bars below the origin still split off it for painting order', () => {
    const result = makeSummaryLayers({
      data: summaryData,
      ...base,
      origin: 6,
      renderingType: RENDERING_TYPE_XYPLOT,
      gradient: true,
    })
    expect(result.map(l => [...l.featureScores])).toEqual([
      [9, 12],
      [8],
      [2, 4],
      [5],
    ])
    expect(result.every(l => l.colorsAbgr === undefined)).toBe(true)
  })

  test('gradient scatter keeps whole untinted bands, back to front', () => {
    const result = gradientLayers(RENDERING_TYPE_SCATTER)
    expect(result.map(l => l.featureScores)).toEqual([
      minScores,
      scores,
      maxScores,
    ])
    for (const layer of result) {
      expect(layer.colorsAbgr).toBeUndefined()
      expect(layer.color).toEqual(posColor)
    }
  })
})
