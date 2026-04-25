import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import {
  isOverlayMode,
  isScatterMode,
  makeWhiskersSourceData,
} from '../../shared/wiggleComponentUtils.ts'
import { getEffectiveScores } from '../../util.ts'

import type { MultiWiggleDataResult } from '../../RenderMultiWiggleDataRPC/types.ts'
import type { SourceRenderData } from '../../shared/wiggleBackendTypes.ts'

// The shape of `model.gpuProps` for MultiLinearWiggleDisplay — the source
// of truth for "settings that affect the per-instance GPU buffer encoding".
// buildMultiSourceRenderData consumes this exact type, so TS forces gpuProps
// and the encoder to stay in sync. The framework reads `self.gpuProps` as
// getUploadInvalidationToken so a change re-uploads without an RPC roundtrip.
export interface MultiWiggleGpuProps {
  sources: { name: string; color?: string }[]
  posColor: string
  negColor: string
  summaryScoreMode: string
  renderingType: string
  isDensityMode: boolean
}

export function buildMultiSourceRenderData(
  data: MultiWiggleDataResult,
  gpuProps: MultiWiggleGpuProps,
): SourceRenderData[] {
  const {
    sources,
    posColor: defaultPosColorStr,
    negColor: defaultNegColorStr,
    summaryScoreMode,
    renderingType,
    isDensityMode,
  } = gpuProps
  const overlay = isOverlayMode(renderingType)
  const scatter = isScatterMode(renderingType)
  const defaultPosColor = cssColorToNormalizedRgb(defaultPosColorStr)
  const defaultNegColor = cssColorToNormalizedRgb(defaultNegColorStr)
  const sourcesByName = new Map(data.sources.map(s => [s.name, s]))
  const orderedSources = sources.length > 0 ? sources : data.sources
  const result: SourceRenderData[] = []
  let rowCounter = 0

  for (const orderedSource of orderedSources) {
    const rpcSource = sourcesByName.get(orderedSource.name)
    if (!rpcSource) {
      continue
    }

    const posColor = orderedSource.color
      ? cssColorToNormalizedRgb(orderedSource.color)
      : defaultPosColor
    const negColor = overlay ? posColor : defaultNegColor
    const row = overlay ? 0 : rowCounter
    rowCounter++

    if (summaryScoreMode === 'whiskers') {
      for (const s of makeWhiskersSourceData(
        rpcSource,
        posColor,
        isDensityMode,
        scatter,
        row,
      )) {
        result.push(s)
      }
    } else if (summaryScoreMode === 'min' || summaryScoreMode === 'max') {
      const scores = getEffectiveScores(rpcSource, summaryScoreMode)
      result.push({
        featurePositions: rpcSource.featurePositions,
        featureScores: scores,
        numFeatures: rpcSource.numFeatures,
        color: posColor,
        rowIndex: row,
      })
    } else {
      if (rpcSource.posNumFeatures > 0) {
        result.push({
          featurePositions: rpcSource.posFeaturePositions,
          featureScores: rpcSource.posFeatureScores,
          numFeatures: rpcSource.posNumFeatures,
          color: posColor,
          rowIndex: row,
        })
      }
      if (rpcSource.negNumFeatures > 0) {
        result.push({
          featurePositions: rpcSource.negFeaturePositions,
          featureScores: rpcSource.negFeatureScores,
          numFeatures: rpcSource.negNumFeatures,
          color: negColor,
          rowIndex: row,
        })
      }
    }
  }

  return result
}
