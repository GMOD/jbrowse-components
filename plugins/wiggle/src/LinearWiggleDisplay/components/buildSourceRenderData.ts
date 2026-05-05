import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import { makeWhiskersSourceData } from '../../shared/wiggleComponentUtils.ts'
import { getEffectiveScores, isDefaultBicolor } from '../../util.ts'

import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'
import type {
  SourceRenderData,
  WiggleBackend,
} from '../../shared/wiggleBackendTypes.ts'

// The shape of `model.gpuProps` — the source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. The SettingsInvalidate autorun reads `void self.gpuProps`, so
// adding a field also auto-wires invalidation. Don't read these settings
// off the model directly — go through gpuProps so the contract holds.
export interface WiggleGpuProps {
  color: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  summaryScoreMode: string
}

export interface WiggleDisplayModel extends WiggleGpuProps {
  rpcDataMap: Map<number, WiggleDataResult>
  height: number
  domain: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
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
  startGpuBackendLifecycle: (backend: WiggleBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  gpuProps: WiggleGpuProps,
): SourceRenderData[] {
  const useBicolor = isDefaultBicolor(gpuProps.color)
  const baseColor = cssColorToNormalizedRgb(gpuProps.color)
  const posColor = cssColorToNormalizedRgb(gpuProps.posColor)
  const negColor = cssColorToNormalizedRgb(gpuProps.negColor)
  const { summaryScoreMode } = gpuProps

  if (summaryScoreMode === 'whiskers') {
    const color = useBicolor ? posColor : baseColor
    const isScatter = gpuProps.renderingType === 'scatter'
    return makeWhiskersSourceData(
      data,
      color,
      gpuProps.isDensityMode,
      isScatter,
      0,
    )
  }

  const scores = getEffectiveScores(data, summaryScoreMode)

  if (!useBicolor) {
    const color = gpuProps.isDensityMode ? posColor : baseColor
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
