import { darkenColor, lightenColor } from './webglUtils.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from './wiggleShader.ts'

import type {
  SourceRenderData,
  WiggleGPURenderState,
} from './WiggleRenderer.ts'

export function getRowHeight(canvasHeight: number, numRows: number) {
  return numRows > 0 ? canvasHeight / numRows : canvasHeight
}

export function getRowTop(rowIndex: number, rowHeight: number) {
  return rowIndex * rowHeight
}

const renderingTypeMap: Record<string, number> = {
  density: RENDERING_TYPE_DENSITY,
  multirowdensity: RENDERING_TYPE_DENSITY,
  line: RENDERING_TYPE_LINE,
  multirowline: RENDERING_TYPE_LINE,
  scatter: RENDERING_TYPE_SCATTER,
  multirowscatter: RENDERING_TYPE_SCATTER,
}

export function renderingTypeToInt(type: string) {
  return renderingTypeMap[type] ?? RENDERING_TYPE_XYPLOT
}

interface FeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
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
  if (isDensityMode || (isScatterMode && !hasSummaryFeatures(data))) {
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
