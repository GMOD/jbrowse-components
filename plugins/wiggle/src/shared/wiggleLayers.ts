// Turning one source's score arrays into the render layers a backend draws:
// which bands a summary mode shows, how each is tinted, and whether a band
// splits into solid-color layers or stays whole with per-instance colors.
// Consumed by buildSourceRenderData, which places the layers in rows.
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { getEffectiveScores } from '@jbrowse/wiggle-core'

import type { FeatureArrays, SourceRenderData } from '@jbrowse/wiggle-core'

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
// and indexed by sign.
function bandColorsAbgr(
  bandScores: Float32Array,
  numFeatures: number,
  pivot: number,
  posColor: [number, number, number],
  negColor: [number, number, number],
  posTint: (c: [number, number, number]) => [number, number, number],
  negTint: (c: [number, number, number]) => [number, number, number],
): Uint32Array {
  const posAbgr = normalizedRgbToABGR(...posTint(posColor))
  const negAbgr = normalizedRgbToABGR(...negTint(negColor))
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
// min/max draw the one band the user picked, untinted: with no sibling band
// beside it there is no magnitude relationship for a tint to carry. Whiskers
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
// (whiskers, or a single min/max band), colored by each value's sign vs the
// pivot so signed data (e.g. phyloP) reads as pos/neg. `summaryBands` above
// decides which bands there are and how each is tinted; this decides how a band
// becomes layers.
//
// Density never reaches here with whiskers: `sourceLayers` gates that on
// `!isDensityMode` and falls through to the avg split. It does reach here with
// min/max, which is why the density flag is taken rather than assumed false.
export function makeSummaryLayers({
  data,
  summaryScoreMode,
  posColor,
  negColor,
  pivot,
  isScatter,
  isFilled,
  isDensityMode,
}: {
  data: FeatureArrays
  summaryScoreMode: string
  posColor: [number, number, number]
  negColor: [number, number, number]
  pivot: number
  isScatter: boolean
  isFilled: boolean
  isDensityMode: boolean
}): WiggleLayer[] {
  const { featurePositions, numFeatures } = data
  const bands = summaryBands(data, summaryScoreMode)

  // Split each band into solid-color pos/neg layers, or keep it whole and color
  // per instance? Two things force the split:
  //   - density paints a row from the layer color alone (`drawDensity` builds
  //     one gradient function per layer and has no per-instance path), and
  //   - filled bars of MORE THAN ONE band nest around the pivot — every band
  //     shares the pivot edge and extends to its value — so they must paint
  //     back-to-front, largest magnitude first. That order is opposite between
  //     the two sides (positive: max..min; negative: min..max), which a single
  //     band order can't express.
  // Everything else keeps the band whole and colors per instance: line/scatter
  // don't overpaint, and a split would break line continuity at every pivot
  // crossing. A lone filled band is in that group too — its pos and neg bars
  // grow away from the pivot in opposite directions and never overlap.
  if (isDensityMode || (isFilled && bands.length > 1)) {
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
    // Positive side back-to-front: max (light, tallest) painted first, min
    // (dark) on top near the pivot. Negative side reverses: min (light,
    // deepest) first, max (dark) on top near the pivot.
    return [
      ...sides.map(s => s.pos),
      ...[...sides].reverse().map(s => s.neg),
    ].filter(l => l !== undefined)
  }

  const layers = bands.map(b => ({
    featurePositions,
    featureScores: b.scores,
    numFeatures,
    color: b.posTint(posColor),
    colorsAbgr: bandColorsAbgr(
      b.scores,
      numFeatures,
      pivot,
      posColor,
      negColor,
      b.posTint,
      b.negTint,
    ),
  }))
  // scatter draws back-to-front, so its layer order is reversed
  return isScatter ? layers.reverse() : layers
}
