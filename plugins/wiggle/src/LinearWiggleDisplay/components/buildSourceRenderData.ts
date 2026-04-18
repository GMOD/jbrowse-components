import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import { makeWhiskersSourceData } from '../../shared/wiggleComponentUtils.ts'
import { getEffectiveScores, isDefaultBicolor } from '../../util.ts'

import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type {
  SourceRenderData,
  WiggleBackend,
} from '../../shared/wiggleBackendTypes.ts'

// Narrow shape that buildSourceRenderData reads from the model — kept
// separate from WiggleDisplayModel so that MST's self (which may not yet
// see later-defined actions at the point of the call) still satisfies it.
export interface WiggleSourceRenderInputs {
  color: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  summaryScoreMode: string
}

export interface WiggleDisplayModel extends WiggleSourceRenderInputs {
  rpcDataMap: Map<number, WiggleDataResult>
  dataVersion: number
  height: number
  domain: [number, number] | undefined
  scaleType: string
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
  startGpuBackendLifecycle: (backend: WiggleBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  model: WiggleSourceRenderInputs,
): SourceRenderData[] {
  const useBicolor = isDefaultBicolor(model.color)
  const baseColor = cssColorToNormalizedRgb(model.color)
  const posColor = cssColorToNormalizedRgb(model.posColor)
  const negColor = cssColorToNormalizedRgb(model.negColor)
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
