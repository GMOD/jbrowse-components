import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  getEffectiveScores,
  resolveRenderState,
  scaleTypeFromString,
} from '@jbrowse/wiggle-core'

import { MULTI_WIGGLE_OVERLAY_TYPES } from '../renderingTypes.ts'

import type {
  FeatureArrays,
  WiggleFeatureUnderMouse,
  WiggleSourceData,
  WiggleTooltipRow,
} from '../util.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

// The rendering-mode vocabulary lives in `@jbrowse/wiggle-core`, next to the
// `WiggleRenderingType` union it inhabits, and is wiggle.slang's own numbering
// generated in (adr-051). Import it from there, not through this module.

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

export function getRowHeight(canvasHeight: number, numRows: number) {
  return numRows > 0 ? canvasHeight / numRows : canvasHeight
}

// Right edge (track-local px) to pin the right-aligned overlays (color/score
// legend) to: the last visible content block's right edge, clamped to the track
// width. At whole-genome zoom the regions can end before the track's right edge,
// where the trailing region-separator/elided PaddingBlock (a TrackContainer
// sibling painted above the `contain: strict` track container) would otherwise
// mask a full-track-width-pinned legend. When content fills the track this is
// just the track width, so the common case is unchanged.
export function legendRightEdgePx(
  visibleRegions: { screenEndPx: number }[],
  totalWidth: number,
) {
  return Math.min(totalWidth, visibleRegions.at(-1)?.screenEndPx ?? totalWidth)
}

export function getRowTop(rowIndex: number, rowHeight: number) {
  return rowIndex * rowHeight
}

const overlayTypes: ReadonlySet<string> = new Set(MULTI_WIGGLE_OVERLAY_TYPES)

export function isOverlayMode(renderingType: string) {
  return overlayTypes.has(renderingType)
}

export function isScatterMode(renderingType: string) {
  return renderingTypeToInt(renderingType) === RENDERING_TYPE_SCATTER
}

// Both line renderings — the stepped bar-tops and the interpolated
// point-to-point one — since they are exactly the ones `lineWidth` applies to.
export function isLineMode(renderingType: string) {
  const type = renderingTypeToInt(renderingType)
  return type === RENDERING_TYPE_LINE || type === RENDERING_TYPE_LINE_CENTER
}

const renderingTypeMap: Record<string, WiggleRenderingType> = {
  xyplot: RENDERING_TYPE_XYPLOT,
  density: RENDERING_TYPE_DENSITY,
  line: RENDERING_TYPE_LINE,
  linecenter: RENDERING_TYPE_LINE_CENTER,
  scatter: RENDERING_TYPE_SCATTER,
  multirowxy: RENDERING_TYPE_XYPLOT,
  multixyplot: RENDERING_TYPE_XYPLOT,
  multirowdensity: RENDERING_TYPE_DENSITY,
  multirowline: RENDERING_TYPE_LINE,
  multirowlinecenter: RENDERING_TYPE_LINE_CENTER,
  multiline: RENDERING_TYPE_LINE,
  multilinecenter: RENDERING_TYPE_LINE_CENTER,
  multirowscatter: RENDERING_TYPE_SCATTER,
  multiscatter: RENDERING_TYPE_SCATTER,
}

export function renderingTypeToInt(type: string): WiggleRenderingType {
  const result = renderingTypeMap[type]
  if (result === undefined) {
    throw new Error(`Unknown wiggle rendering type: ${type}`)
  }
  return result
}

// A source's contribution to the render, before it's placed in a row. Same
// shape as SourceRenderData minus rowIndex, which buildSourceRenderData assigns
// once so row-placement lives in a single spot.
export type WiggleLayer = Omit<SourceRenderData, 'rowIndex'>

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
  const avg = { scores: data.featureScores, posTint: noTint, negTint: noTint }
  if (summaryScoreMode !== 'whiskers') {
    return [
      {
        scores: getEffectiveScores(data, summaryScoreMode),
        posTint: noTint,
        negTint: noTint,
      },
    ]
  }
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

// Binary search for the feature at a given base-pair offset.
// featurePositions is sorted by start (featurePositions[i*2]), so we find the
// rightmost feature whose start <= bpOffset, then confirm bpOffset < its end.
export function findFeatureAtBp(
  featurePositions: Uint32Array,
  numFeatures: number,
  bpOffset: number,
) {
  let lo = 0
  let hi = numFeatures - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (featurePositions[mid * 2]! <= bpOffset) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found === -1) {
    return -1
  }
  return bpOffset < featurePositions[found * 2 + 1]! ? found : -1
}

// Spread-friendly helper: returns `{ summary, minScore, maxScore }` when the
// feature is a real summary (min/max diverge from score) and the user isn't
// asking for plain 'avg'. Otherwise returns `{}` so the tooltip omits those
// fields. Used by both single- and multi-wiggle hit handlers.
function summaryFields(
  score: number,
  minScore: number | undefined,
  maxScore: number | undefined,
  summaryScoreMode: string,
): { summary: true; minScore: number; maxScore: number } | { summary?: false } {
  return summaryScoreMode !== 'avg' &&
    minScore !== undefined &&
    maxScore !== undefined &&
    (minScore !== score || maxScore !== score)
    ? { summary: true, minScore, maxScore }
    : {}
}

// Build a tooltip row from a source's typed arrays at index `i`. `name`/`color`
// are set for multi-wiggle and omitted for single-wiggle.
export function makeTooltipRow(
  source: WiggleSourceData,
  i: number,
  summaryScoreMode: string,
  name?: string,
  color?: string,
): WiggleTooltipRow {
  const score = source.featureScores[i]!
  return {
    source: name,
    color,
    score,
    ...summaryFields(
      score,
      source.featureMinScores[i],
      source.featureMaxScores[i],
      summaryScoreMode,
    ),
  }
}

// Feature-widget payload for a clicked wiggle hit, shared by single- and
// multi-wiggle. Single-wiggle has one unnamed row keyed as `score`; multi has
// one entry per source name.
export function wiggleFeatureWidgetData(
  feat: WiggleFeatureUnderMouse,
): SimpleFeatureSerialized {
  return {
    uniqueId: `wiggle-${feat.refName}-${feat.start}-${feat.end}`,
    refName: feat.refName,
    start: feat.start,
    end: feat.end,
    sources: Object.fromEntries(
      feat.rows.map(r => [r.source ?? 'score', r.score]),
    ),
  }
}

// Single-row hit: the feature interval at `bp` in one source plus its one row.
// Used by single-wiggle and multi-wiggle row mode (overlay mode collects many
// rows and uses the cursor bp instead, so it builds its result directly).
export function findSourceHit(
  source: WiggleSourceData,
  bp: number,
  refName: string,
  summaryScoreMode: string,
  name?: string,
  color?: string,
): WiggleFeatureUnderMouse | undefined {
  const { featurePositions, numFeatures } = source
  const i = findFeatureAtBp(featurePositions, numFeatures, bp)
  return i === -1
    ? undefined
    : {
        refName,
        start: featurePositions[i * 2]!,
        end: featurePositions[i * 2 + 1]!,
        rows: [makeTooltipRow(source, i, summaryScoreMode, name, color)],
      }
}

export interface MouseRegion {
  refName: string
  screenStartPx: number
  screenEndPx: number
  start: number
  end: number
  reversed?: boolean
  displayedRegionIndex: number
}

// The 0-based base under a fractional position through a region.
//
// Counts bases from the region's left screen edge and flips for `reversed`,
// rather than flooring a flipped continuous coordinate. Two reasons:
//   - `floor`, not `round`. Rounding snaps to the nearest base *boundary*, so it
//     reports the next base across the right half of every base's pixels — an
//     off-by-one tooltip on base-resolution data at high zoom.
//   - flooring a *decreasing* coordinate (the `reversed` case) is itself off by
//     one at exact base boundaries, which at high zoom land on integer pixels
//     constantly. Indexing from the left keeps both orientations exact.
// `frac < 1` holds (screenEndPx is exclusive), so the index stays within the
// region; the clamp is float-rounding insurance only.
function baseAtFraction(region: MouseRegion, frac: number) {
  const { start, end, reversed } = region
  const span = end - start
  const index = Math.min(span - 1, Math.max(0, Math.floor(frac * span)))
  return reversed ? end - 1 - index : start + index
}

// Maps a screen x coordinate to the region containing it, the per-region data
// keyed by displayedRegionIndex, and the absolute genomic bp under the cursor.
// Returns undefined if x is outside any region or no data is loaded.
export function hitTestMouse<R extends MouseRegion, D>(
  regions: R[],
  rpcDataMap: ReadonlyMap<number, D>,
  offsetX: number,
) {
  const region = regions.find(
    r => offsetX >= r.screenStartPx && offsetX < r.screenEndPx,
  )
  if (!region) {
    return undefined
  }
  const data = rpcDataMap.get(region.displayedRegionIndex)
  if (!data) {
    return undefined
  }
  const blockWidth = region.screenEndPx - region.screenStartPx
  const frac = (offsetX - region.screenStartPx) / blockWidth
  return { region, data, bp: baseAtFraction(region, frac) }
}

// Everything in a wiggle-family render state except the canvas box comes off
// the model, so the two displays supply only what genuinely differs: single
// wiggle insets by the scalebar label gutter and draws one row, multi stacks
// rows edge-to-edge over the full height.
interface WiggleRenderStateModel {
  domain: [number, number] | undefined
  scaleType: string
  renderingType: string
  scatterPointSize: number
  lineWidth: number
  bicolorPivot: number
}

// Always defined: until autoscale resolves a domain, resolveRenderState
// substitutes a [0,1] stub so an uncovered region still renders (clears the
// canvas, flips canvasDrawn, instead of spinning forever). "Still loading" is
// expressed separately by the boolean `renderBlocks` returns.
export function makeWiggleRenderState(
  self: WiggleRenderStateModel,
  {
    width,
    height,
    numRows,
  }: { width: number; height: number; numRows: number },
): WiggleGPURenderState {
  return resolveRenderState(self.domain, domainY => ({
    domainY,
    scaleType: scaleTypeFromString(self.scaleType),
    renderingType: renderingTypeToInt(self.renderingType),
    canvasWidth: width,
    canvasHeight: height,
    // Floored at 1: a source list that filters to empty (a subtree filter
    // naming nothing present) leaves numRows 0. Nothing is encoded for that
    // state any more, but the shader's bare `canvasHeight / numRows` divides
    // regardless of instance count and would seed the row transform with
    // Infinity. Flooring here is the one place both backends read.
    numRows: Math.max(1, numRows),
    scatterPointSize: self.scatterPointSize,
    lineWidth: self.lineWidth,
    // bars pivot around, and density fades from, the bicolor threshold
    origin: self.bicolorPivot,
  }))
}
