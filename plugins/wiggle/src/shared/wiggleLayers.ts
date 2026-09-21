// Turning one source's score arrays into the render layers a backend draws:
// which bands a summary mode shows, how each is tinted, and whether a band
// splits into solid-color layers or stays whole with per-instance colors.
// Consumed by buildSourceRenderData, which places the layers in rows.
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  getEffectiveScores,
} from '@jbrowse/wiggle-core'

import type {
  FeatureArrays,
  SourceRenderData,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

function lightenColor(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.min(1, rgb[0] + (1 - rgb[0]) * amount),
    Math.min(1, rgb[1] + (1 - rgb[1]) * amount),
    Math.min(1, rgb[2] + (1 - rgb[2]) * amount),
  ]
}

function darkenColor(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount)]
}

// A source's contribution to the render, before it's placed in a row: geometry
// and color. The two fields SourceRenderData has on top of that are the two
// buildSourceRenderData stamps — `rowIndex`, so row-placement lives in a single
// spot, and `renderingType`, so the rendering a layer is encoded for is decided
// once alongside which layers there are at all.
export type WiggleLayer = Omit<SourceRenderData, 'rowIndex' | 'renderingType'>

// One whisker band's per-instance colors: each feature gets posColor or negColor
// by whether that band's value sits above or below the pivot, then the band tint
// is baked in. The tint is mirrored across the pivot so lightness always tracks
// magnitude, not signed value: on the positive side the max band lightens and
// the min band darkens (biggest positive = lightest); on the negative side that
// flips (posTint vs negTint), so the most-negative min band lightens and the
// least-negative max band darkens (most negative = lightest red, not a dark
// brown). Only two packed colors are possible per band, so they're computed once
// and indexed by sign — and where they come out the same (a solid-color track,
// `posColor === negColor`), the band carries no per-instance lane at all and
// both backends read the layer color.
function bandColorsAbgr(
  bandScores: Float32Array,
  numFeatures: number,
  pivot: number,
  posColor: [number, number, number],
  negColor: [number, number, number],
  posTint: (c: [number, number, number]) => [number, number, number],
  negTint: (c: [number, number, number]) => [number, number, number],
): Uint32Array | undefined {
  const posAbgr = normalizedRgbToABGR(...posTint(posColor))
  const negAbgr = normalizedRgbToABGR(...negTint(negColor))
  if (posAbgr === negAbgr) {
    return undefined
  }
  const out = new Uint32Array(numFeatures)
  for (let i = 0; i < numFeatures; i++) {
    out[i] = bandScores[i]! >= pivot ? posAbgr : negAbgr
  }
  return out
}

// How a band's base color is shifted to convey magnitude. See summaryBands.
type Tint = (c: [number, number, number]) => [number, number, number]

const noTint: Tint = c => c
const lighten: Tint = c => lightenColor(c, 0.4)
const darken: Tint = c => darkenColor(c, 0.4)

// One score band to draw, and the tint each side of the pivot takes.
interface ScoreBand {
  scores: Float32Array
  posTint: Tint
  negTint: Tint
}

// The bands a summary mode draws, ordered outermost-first (max, avg, min).
//
// The tint is mirrored across the pivot so lightness always tracks magnitude,
// not signed value: on the positive side the max band lightens and the min band
// darkens (biggest positive = lightest); on the negative side that flips, so the
// most-negative min band lightens and the least-negative max band darkens (most
// negative = lightest red, not a dark brown).
//
// avg and min/max draw one band, untinted: with no sibling band beside it
// there is no magnitude relationship for a tint to carry. Whiskers
// collapses to the avg band alone when the data has no summary variation, since
// processFeaturesFromArrays aliases min/max onto featureScores there and the
// other two bands would paint the same values twice more.
function summaryBands(
  data: FeatureArrays,
  summaryScoreMode: string,
): ScoreBand[] {
  if (summaryScoreMode !== 'whiskers') {
    return [
      {
        scores: getEffectiveScores(data, summaryScoreMode),
        posTint: noTint,
        negTint: noTint,
      },
    ]
  }
  const avg = { scores: data.featureScores, posTint: noTint, negTint: noTint }
  return data.hasSummaryScores
    ? [
        { scores: data.featureMaxScores, posTint: lighten, negTint: darken },
        avg,
        { scores: data.featureMinScores, posTint: darken, negTint: lighten },
      ]
    : [avg]
}

// One band split into its above-pivot and below-pivot solid-color layers,
// `undefined` for an empty side. Both sides come out of one counting pass plus
// one fill pass, and a single-sided band (all-positive coverage, the common
// case) aliases the band arrays instead of copying them.
function whiskerBandSides(
  featurePositions: Uint32Array,
  bandScores: Float32Array,
  numFeatures: number,
  pivot: number,
  posColor: [number, number, number],
  negColor: [number, number, number],
): { pos: WiggleLayer | undefined; neg: WiggleLayer | undefined } {
  let posCount = 0
  for (let i = 0; i < numFeatures; i++) {
    if (bandScores[i]! >= pivot) {
      posCount++
    }
  }
  const negCount = numFeatures - posCount
  const whole = (color: [number, number, number]) => ({
    featurePositions,
    featureScores: bandScores,
    numFeatures,
    color,
  })
  if (negCount === 0) {
    return {
      pos: posCount === 0 ? undefined : whole(posColor),
      neg: undefined,
    }
  }
  if (posCount === 0) {
    return { pos: undefined, neg: whole(negColor) }
  }

  const posPositions = new Uint32Array(posCount * 2)
  const posScores = new Float32Array(posCount)
  const negPositions = new Uint32Array(negCount * 2)
  const negScores = new Float32Array(negCount)
  let p = 0
  let n = 0
  for (let i = 0; i < numFeatures; i++) {
    const score = bandScores[i]!
    const start = featurePositions[i * 2]!
    const end = featurePositions[i * 2 + 1]!
    if (score >= pivot) {
      posPositions[p * 2] = start
      posPositions[p * 2 + 1] = end
      posScores[p] = score
      p++
    } else {
      negPositions[n * 2] = start
      negPositions[n * 2 + 1] = end
      negScores[n] = score
      n++
    }
  }
  return {
    pos: {
      featurePositions: posPositions,
      featureScores: posScores,
      numFeatures: posCount,
      color: posColor,
    },
    neg: {
      featurePositions: negPositions,
      featureScores: negScores,
      numFeatures: negCount,
      color: negColor,
    },
  }
}

// The render layers one source contributes under a summary presentation
// (avg, whiskers, or a single min/max band), colored by each value's sign vs
// the pivot so signed data (e.g. phyloP) reads as pos/neg. Line plots take
// `lineLayers` instead. `summaryBands` decides which bands there are and this
// decides how each becomes layers.
export function makeSummaryLayers({
  data,
  summaryScoreMode,
  posColor,
  negColor,
  pivot,
  origin,
  renderingType,
}: {
  data: FeatureArrays
  summaryScoreMode: string
  posColor: [number, number, number]
  negColor: [number, number, number]
  pivot: number
  origin: number
  renderingType: WiggleRenderingType
}): WiggleLayer[] {
  const { featurePositions, numFeatures } = data
  const isDensityMode = renderingType === RENDERING_TYPE_DENSITY
  const isFilled = renderingType === RENDERING_TYPE_XYPLOT
  const bands = summaryBands(data, summaryScoreMode)

  // Split each band into solid-color pos/neg layers, or keep it whole and color
  // per instance? Two things force the split:
  //   - density paints a row from the layer color alone (`drawDensity` builds
  //     one gradient function per layer and has no per-instance path), and
  //   - filled bars of MORE THAN ONE band nest around the origin — every band
  //     shares the origin edge and extends to its value — so they must paint
  //     back-to-front, largest magnitude first. That order is opposite between
  //     the two sides (positive: max..min; negative: min..max), which a single
  //     band order can't express.
  // Everything else keeps the band whole and colors per instance: scatter
  // doesn't overpaint. A lone filled band is in that group too — its pos and
  // neg bars grow away from the origin in opposite directions and never overlap.
  if (isDensityMode) {
    const sides = bands.map(b =>
      whiskerBandSides(
        featurePositions,
        b.scores,
        numFeatures,
        pivot,
        b.posTint(posColor),
        b.negTint(negColor),
      ),
    )
    return [
      ...sides.map(s => s.pos),
      ...[...sides].reverse().map(s => s.neg),
    ].filter(l => l !== undefined)
  }
  if (isFilled && bands.length > 1) {
    // The sides are the ones bars grow into from the origin, which sets the
    // painting order; each bar still takes its colour from its side of the
    // pivot, which is the same side unless a threshold cuts elsewhere.
    const sides = bands.map(b => {
      const { pos, neg } = whiskerBandSides(
        featurePositions,
        b.scores,
        numFeatures,
        origin,
        b.posTint(posColor),
        b.negTint(negColor),
      )
      const colored = (layer: WiggleLayer | undefined, tint: Tint) => {
        if (!layer || origin === pivot) {
          return layer
        }
        const colorsAbgr = bandColorsAbgr(
          layer.featureScores,
          layer.numFeatures,
          pivot,
          posColor,
          negColor,
          tint,
          tint,
        )
        return colorsAbgr ? { ...layer, colorsAbgr } : layer
      }
      return { pos: colored(pos, b.posTint), neg: colored(neg, b.negTint) }
    })
    // Positive side back-to-front: max (light, tallest) painted first, min
    // (dark) on top near the origin. Negative side reverses: min (light,
    // deepest) first, max (dark) on top near the origin.
    return [
      ...sides.map(s => s.pos),
      ...[...sides].reverse().map(s => s.neg),
    ].filter(l => l !== undefined)
  }

  const layers = bands.map(b => {
    const colorsAbgr = bandColorsAbgr(
      b.scores,
      numFeatures,
      pivot,
      posColor,
      negColor,
      b.posTint,
      b.negTint,
    )
    return {
      featurePositions,
      featureScores: b.scores,
      numFeatures,
      color: b.posTint(posColor),
      ...(colorsAbgr ? { colorsAbgr } : {}),
    }
  })
  // scatter draws back-to-front, so its layer order is reversed
  return renderingType === RENDERING_TYPE_SCATTER ? layers.reverse() : layers
}

// One line through every bin in any mode, never the worker's pos/neg split,
// which chorded the positive line across every negative stretch.
export function lineLayers(
  data: FeatureArrays,
  summaryScoreMode: string,
  posColor: [number, number, number],
  negColor: [number, number, number],
): WiggleLayer[] {
  const { featurePositions, numFeatures } = data
  const line = {
    featurePositions,
    featureScores: getEffectiveScores(data, summaryScoreMode),
    numFeatures,
    color: posColor,
    negColor,
  }
  return summaryScoreMode === 'whiskers' && data.hasSummaryScores
    ? [
        {
          featurePositions,
          featureScores: data.featureMaxScores,
          numFeatures,
          color: posColor,
          negColor,
          band: { minScores: data.featureMinScores },
        },
        line,
      ]
    : [line]
}
