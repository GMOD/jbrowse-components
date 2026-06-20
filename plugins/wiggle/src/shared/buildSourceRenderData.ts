import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import {
  isOverlayMode,
  isScatterMode,
  makeWhiskersSourceData,
} from './wiggleComponentUtils.ts'
import { getEffectiveScores } from '../util.ts'

import type { WiggleDataResult } from '../util.ts'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// The shape of `model.gpuProps` — single source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. The framework reads `self.gpuProps` as getUploadInvalidationToken
// so a change re-uploads without an RPC roundtrip.
export interface WiggleGpuProps {
  sources: { name: string; color?: string }[]
  posColor: string
  negColor: string
  summaryScoreMode: string
  renderingType: string
  isDensityMode: boolean
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  gpuProps: WiggleGpuProps,
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

  // rowIndex is the source's position in orderedSources so it lines up with the
  // model's numSources-based rowHeight and findHit's visibleSources[rowIdx],
  // even when an earlier source is missing from the RPC payload.
  for (let i = 0; i < orderedSources.length; i++) {
    const orderedSource = orderedSources[i]!
    const rpcSource = sourcesByName.get(orderedSource.name)
    if (!rpcSource) {
      continue
    }

    const posColor = orderedSource.color
      ? cssColorToNormalizedRgb(orderedSource.color)
      : defaultPosColor
    const negColor = overlay ? posColor : defaultNegColor
    const row = overlay ? 0 : i

    // summaryScoreMode selects the rendering; the bicolor pos/neg split is the
    // 'avg' presentation (the only mode with a meaningful pos/neg variant).
    // whiskers/min/max read the full (unsplit) score arrays, so they render
    // regardless of bicolor — they don't depend on a solid color being set,
    // and the drawn output matches the autoscale domain (which already follows
    // summaryScoreMode). density has no whiskers variant, so it falls through
    // to the avg split.
    if (summaryScoreMode === 'whiskers' && !isDensityMode) {
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
      // avg: pos/neg split, each side colored by sign. Solid color is encoded
      // upstream by the worker placing every feature in the pos arrays
      // (useBicolor=false), so this same branch renders it as one color.
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
