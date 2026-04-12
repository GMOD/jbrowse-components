import { parseColor } from '../../shared/webglUtils.ts'
import { makeWhiskersSourceData } from '../../shared/wiggleComponentUtils.ts'
import { getEffectiveScores, isDefaultBicolor } from '../../util.ts'

import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { SourceRenderData } from '../../shared/wiggleBackendTypes.ts'

export interface WiggleDisplayModel {
  rpcDataMap: Map<number, WiggleDataResult>
  dataVersion: number
  height: number
  domain: [number, number] | undefined
  scaleType: string
  color: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  summaryScoreMode: string
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
  featureUnderMouse?: {
    refName: string
    start: number
    end: number
    score: number
    minScore?: number
    maxScore?: number
    summary?: boolean
  }
  setFeatureUnderMouse: (feat?: WiggleDisplayModel['featureUnderMouse']) => void
  reload: () => void
  canvasDrawn: boolean
  setCanvasDrawn: (flag: boolean) => void
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  model: WiggleDisplayModel,
): SourceRenderData[] {
  const useBicolor = isDefaultBicolor(model.color)
  const baseColor = parseColor(model.color)
  const posColor = parseColor(model.posColor)
  const negColor = parseColor(model.negColor)
  const { summaryScoreMode } = model

  if (summaryScoreMode === 'whiskers') {
    const color = useBicolor ? posColor : baseColor
    const isScatter = model.renderingType === 'scatter'
    return makeWhiskersSourceData(
      data,
      color,
      model.isDensityMode,
      isScatter,
      0,
    )
  }

  const scores = getEffectiveScores(data, summaryScoreMode)

  if (!useBicolor) {
    const color = model.isDensityMode ? posColor : baseColor
    return [
      {
        featurePositions: data.featurePositions,
        featureScores: scores,
        numFeatures: data.numFeatures,
        color,
        rowIndex: 0,
      },
    ]
  }

  if (summaryScoreMode === 'min' || summaryScoreMode === 'max') {
    return [
      {
        featurePositions: data.featurePositions,
        featureScores: scores,
        numFeatures: data.numFeatures,
        color: posColor,
        rowIndex: 0,
      },
    ]
  }

  const sources: SourceRenderData[] = []
  if (data.posNumFeatures > 0) {
    sources.push({
      featurePositions: data.posFeaturePositions,
      featureScores: data.posFeatureScores,
      numFeatures: data.posNumFeatures,
      color: posColor,
      rowIndex: 0,
    })
  }
  if (data.negNumFeatures > 0) {
    sources.push({
      featurePositions: data.negFeaturePositions,
      featureScores: data.negFeatureScores,
      numFeatures: data.negNumFeatures,
      color: negColor,
      rowIndex: 0,
    })
  }
  return sources
}
