import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { scaleTypeFromString } from '@jbrowse/wiggle-core'

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

export { SCALE_TYPE_LINEAR, SCALE_TYPE_LOG } from '@jbrowse/wiggle-core'
export { SMALL_POINT_MAX_DIAMETER_PX } from '@jbrowse/wiggle-core'

export const RENDERING_TYPE_XYPLOT: WiggleRenderingType = 0
export const RENDERING_TYPE_DENSITY: WiggleRenderingType = 1
export const RENDERING_TYPE_LINE: WiggleRenderingType = 2
export const RENDERING_TYPE_SCATTER: WiggleRenderingType = 3
// Point-to-point line: connects the score at each feature's bp midpoint to its
// neighbor's, instead of tracing the stepped bar tops that RENDERING_TYPE_LINE
// draws. Better for sparse/discrete data where the plateaus look wrong.
export const RENDERING_TYPE_LINE_CENTER: WiggleRenderingType = 4

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

const overlayTypes = new Set([
  'multixyplot',
  'multiline',
  'multilinecenter',
  'multiscatter',
])

export function isOverlayMode(renderingType: string) {
  return overlayTypes.has(renderingType)
}

export function isScatterMode(renderingType: string) {
  return renderingTypeToInt(renderingType) === RENDERING_TYPE_SCATTER
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

const noTint = (c: [number, number, number]) => c
const lighten = (c: [number, number, number]) => lightenColor(c, 0.4)
const darken = (c: [number, number, number]) => darkenColor(c, 0.4)

// One side of a whisker band as a solid-color layer: only the features whose
// value sits on `keepPos`'s side of the pivot, returning undefined when that
// side is empty. Filled rendering splits each band by sign because the two
// sides must stack in opposite order (see makeWhiskersLayers) — a split can't
// be avoided the way per-instance coloring avoids it for line/scatter.
function whiskerBandSide(
  featurePositions: Uint32Array,
  bandScores: Float32Array,
  numFeatures: number,
  pivot: number,
  keepPos: boolean,
  color: [number, number, number],
): WiggleLayer | undefined {
  let count = 0
  for (let i = 0; i < numFeatures; i++) {
    if (bandScores[i]! >= pivot === keepPos) {
      count++
    }
  }
  if (count === 0) {
    return undefined
  }
  const positions = new Uint32Array(count * 2)
  const scores = new Float32Array(count)
  let j = 0
  for (let i = 0; i < numFeatures; i++) {
    if (bandScores[i]! >= pivot === keepPos) {
      positions[j * 2] = featurePositions[i * 2]!
      positions[j * 2 + 1] = featurePositions[i * 2 + 1]!
      scores[j] = bandScores[i]!
      j++
    }
  }
  return {
    featurePositions: positions,
    featureScores: scores,
    numFeatures: count,
    color,
  }
}

// The min/avg/max whisker layers for one source. Each band is bicolor: colored
// by its own value's sign vs the pivot (posColor above, negColor below), so
// signed data (e.g. phyloP) reads as pos/neg while a magnitude-based tint conveys
// the whisker range. The tint mirrors across the pivot so the largest magnitude
// in either direction is always the lightest.
//
// Filled (xyplot) bars nest around the pivot — every band shares the pivot edge
// and extends to its value — so they must paint back-to-front, largest magnitude
// first. That order is opposite between the two sides (positive: max..min;
// negative: min..max), which a single band order can't express, so filled
// rendering splits each band by sign into solid-color layers. Line/scatter don't
// overpaint, so they keep the bands whole (a split would break line continuity
// at pivot crossings) and color per instance; scatter draws back-to-front, so
// its layer order is reversed. Collapses to just the avg layer in density mode or
// when the data carries no summary variation.
export function makeWhiskersLayers({
  data,
  posColor,
  negColor,
  pivot,
  isDensityMode,
  isScatter,
  isFilled,
}: {
  data: FeatureArrays
  posColor: [number, number, number]
  negColor: [number, number, number]
  pivot: number
  isDensityMode: boolean
  isScatter: boolean
  isFilled: boolean
}): WiggleLayer[] {
  const { featurePositions, numFeatures } = data
  const avg = {
    featurePositions,
    featureScores: data.featureScores,
    numFeatures,
    color: posColor,
    colorsAbgr: bandColorsAbgr(
      data.featureScores,
      numFeatures,
      pivot,
      posColor,
      negColor,
      noTint,
      noTint,
    ),
  }
  if (isDensityMode || !data.hasSummaryScores) {
    return [avg]
  }

  if (isFilled) {
    // Each band's positive and negative tints, ordered max..avg..min. Lightest at
    // the extreme (max above the pivot, min below), darkening toward the pivot.
    const bands = [
      {
        scores: data.featureMaxScores,
        pos: lighten(posColor),
        neg: darken(negColor),
      },
      { scores: data.featureScores, pos: posColor, neg: negColor },
      {
        scores: data.featureMinScores,
        pos: darken(posColor),
        neg: lighten(negColor),
      },
    ]
    // Positive side back-to-front: max (light, tallest) painted first, min (dark)
    // on top near the pivot. Negative side reverses: min (light, deepest) first,
    // max (dark) on top near the pivot.
    const posSide = bands.map(b =>
      whiskerBandSide(
        featurePositions,
        b.scores,
        numFeatures,
        pivot,
        true,
        b.pos,
      ),
    )
    const negSide = [...bands]
      .reverse()
      .map(b =>
        whiskerBandSide(
          featurePositions,
          b.scores,
          numFeatures,
          pivot,
          false,
          b.neg,
        ),
      )
    return [...posSide, ...negSide].filter(l => l !== undefined)
  }

  const layers = [
    {
      featurePositions,
      featureScores: data.featureMaxScores,
      numFeatures,
      color: lighten(posColor),
      colorsAbgr: bandColorsAbgr(
        data.featureMaxScores,
        numFeatures,
        pivot,
        posColor,
        negColor,
        lighten,
        darken,
      ),
    },
    avg,
    {
      featurePositions,
      featureScores: data.featureMinScores,
      numFeatures,
      color: darken(posColor),
      colorsAbgr: bandColorsAbgr(
        data.featureMinScores,
        numFeatures,
        pivot,
        posColor,
        negColor,
        darken,
        lighten,
      ),
    },
  ]
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

export function makeRenderState(
  domain: [number, number],
  scaleType: string,
  renderingType: string,
  width: number,
  height: number,
  numRows: number,
  scatterPointSize: number,
  lineWidth: number,
  origin: number,
): WiggleGPURenderState {
  return {
    domainY: domain,
    scaleType: scaleTypeFromString(scaleType),
    renderingType: renderingTypeToInt(renderingType),
    canvasWidth: width,
    canvasHeight: height,
    numRows,
    scatterPointSize,
    lineWidth,
    origin,
  }
}
