import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from './wiggleShader.ts'

import type { FeatureArrays } from '../util.ts'
import type {
  SourceRenderData,
  WiggleGPURenderState,
} from './wiggleBackendTypes.ts'

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

const renderingTypeMap: Record<string, number> = {
  multirowxy: RENDERING_TYPE_XYPLOT,
  multixyplot: RENDERING_TYPE_XYPLOT,
  multirowdensity: RENDERING_TYPE_DENSITY,
  multirowline: RENDERING_TYPE_LINE,
  multiline: RENDERING_TYPE_LINE,
  multirowscatter: RENDERING_TYPE_SCATTER,
  multiscatter: RENDERING_TYPE_SCATTER,
}

export function renderingTypeToInt(type: string) {
  return renderingTypeMap[type] ?? RENDERING_TYPE_XYPLOT
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
  isScatterMode: boolean,
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
  if (isScatterMode) {
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
