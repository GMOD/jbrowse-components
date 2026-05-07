import type { FeatureArrays } from '../util.ts'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingType,
  WiggleScaleType,
} from './wiggleBackendTypes.ts'

export const RENDERING_TYPE_XYPLOT: WiggleRenderingType = 0
export const RENDERING_TYPE_DENSITY: WiggleRenderingType = 1
export const RENDERING_TYPE_LINE: WiggleRenderingType = 2
export const RENDERING_TYPE_SCATTER: WiggleRenderingType = 3
export const SCALE_TYPE_LINEAR: WiggleScaleType = 0
export const SCALE_TYPE_LOG: WiggleScaleType = 1

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

export function getRowTop(rowIndex: number, rowHeight: number) {
  return rowIndex * rowHeight
}

const overlayTypes = new Set(['multixyplot', 'multiline', 'multiscatter'])

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
  scatter: RENDERING_TYPE_SCATTER,
  multirowxy: RENDERING_TYPE_XYPLOT,
  multixyplot: RENDERING_TYPE_XYPLOT,
  multirowdensity: RENDERING_TYPE_DENSITY,
  multirowline: RENDERING_TYPE_LINE,
  multiline: RENDERING_TYPE_LINE,
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

function hasSummaryFeatures(data: FeatureArrays) {
  for (let i = 0; i < data.numFeatures; i++) {
    if (
      data.featureMinScores[i] !== data.featureScores[i] ||
      data.featureMaxScores[i] !== data.featureScores[i]
    ) {
      return true
    }
  }
  return false
}

export function makeWhiskersSourceData(
  data: FeatureArrays,
  color: [number, number, number],
  isDensityMode: boolean,
  isScatter: boolean,
  rowIndex: number,
): SourceRenderData[] {
  const singleSource = [
    {
      featurePositions: data.featurePositions,
      featureScores: data.featureScores,
      numFeatures: data.numFeatures,
      color,
      rowIndex,
    },
  ]
  if (isDensityMode || !hasSummaryFeatures(data)) {
    return singleSource
  }
  const sources = [
    {
      featurePositions: data.featurePositions,
      featureScores: data.featureMaxScores,
      numFeatures: data.numFeatures,
      color: lightenColor(color, 0.4),
      rowIndex,
    },
    ...singleSource,
    {
      featurePositions: data.featurePositions,
      featureScores: data.featureMinScores,
      numFeatures: data.numFeatures,
      color: darkenColor(color, 0.4),
      rowIndex,
    },
  ]
  if (isScatter) {
    sources.reverse()
  }
  return sources
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

export function isSummaryFeature(
  score: number,
  minScore: number | undefined,
  maxScore: number | undefined,
) {
  return (
    minScore !== undefined &&
    maxScore !== undefined &&
    (minScore !== score || maxScore !== score)
  )
}

interface MouseRegion {
  refName: string
  screenStartPx: number
  screenEndPx: number
  start: number
  end: number
  reversed?: boolean
  displayedRegionIndex: number
}

// Maps a screen x coordinate to the region containing it, the per-region data
// keyed by displayedRegionIndex, and the absolute genomic bp under the cursor.
// Returns undefined if x is outside any region or no data is loaded.
export function hitTestMouse<R extends MouseRegion, D>(
  regions: R[],
  rpcDataMap: Map<number, D>,
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
  const span = region.end - region.start
  const bp = Math.round(
    region.reversed ? region.end - frac * span : region.start + frac * span,
  )
  return { region, data, bp }
}

export function makeRenderState(
  domain: [number, number],
  scaleType: string,
  renderingType: string,
  width: number,
  height: number,
): WiggleGPURenderState {
  return {
    domainY: domain,
    scaleType: scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    renderingType: renderingTypeToInt(renderingType),
    canvasWidth: width,
    canvasHeight: height,
  }
}
