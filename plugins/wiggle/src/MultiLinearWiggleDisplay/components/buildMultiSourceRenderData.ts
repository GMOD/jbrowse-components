import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import {
  isOverlayMode,
  isScatterMode,
  makeWhiskersSourceData,
} from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDataResult } from '../../RenderMultiWiggleDataRPC/types.ts'
import type { SourceRenderData } from '../../shared/wiggleBackendTypes.ts'

export function buildMultiSourceRenderData(
  data: MultiWiggleDataResult,
  modelSources: { name: string; color?: string }[],
  defaultPosColor: [number, number, number],
  defaultNegColor: [number, number, number],
  summaryScoreMode: string,
  renderingType: string,
  isDensityMode: boolean,
): SourceRenderData[] {
  const overlay = isOverlayMode(renderingType)
  const scatter = isScatterMode(renderingType)
  const sourcesByName = new Map(data.sources.map(s => [s.name, s]))
  const orderedSources = modelSources.length > 0 ? modelSources : data.sources
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
      const scores =
        summaryScoreMode === 'min'
          ? rpcSource.featureMinScores
          : rpcSource.featureMaxScores
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
