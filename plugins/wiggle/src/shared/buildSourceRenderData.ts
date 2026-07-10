import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import {
  isOverlayMode,
  isScatterMode,
  makeWhiskersLayers,
} from './wiggleComponentUtils.ts'
import { getEffectiveScores } from '../util.ts'

import type { WiggleLayer } from './wiggleComponentUtils.ts'
import type { WiggleDataResult } from '../util.ts'
import type { SourceRenderData, WiggleSourceData } from '@jbrowse/wiggle-core'

// The render layers one source contributes, chosen by summaryScoreMode but
// independent of where the source sits on screen. buildSourceRenderData stamps
// each with a rowIndex afterward, keeping row-placement in one place.
function sourceLayers({
  source,
  summaryScoreMode,
  isDensityMode,
  scatter,
  posColor,
  negColor,
}: {
  source: WiggleSourceData
  summaryScoreMode: string
  isDensityMode: boolean
  scatter: boolean
  posColor: [number, number, number]
  negColor: [number, number, number]
}): WiggleLayer[] {
  // summaryScoreMode selects the presentation. whiskers/min/max read the full
  // (unsplit) score arrays, so they render regardless of the bicolor pos/neg
  // split, which is the 'avg' presentation. density has no whiskers variant, so
  // it falls through to the avg split.
  if (summaryScoreMode === 'whiskers' && !isDensityMode) {
    return makeWhiskersLayers({
      data: source,
      color: posColor,
      isDensityMode,
      isScatter: scatter,
    })
  } else if (summaryScoreMode === 'min' || summaryScoreMode === 'max') {
    return [
      {
        featurePositions: source.featurePositions,
        featureScores: getEffectiveScores(source, summaryScoreMode),
        numFeatures: source.numFeatures,
        color: posColor,
      },
    ]
  } else {
    // avg: pos/neg split, each side colored by sign. A solid color is encoded
    // upstream by the worker placing every feature in the pos arrays, so this
    // same branch renders it as one color.
    const layers: WiggleLayer[] = []
    if (source.posNumFeatures > 0) {
      layers.push({
        featurePositions: source.posFeaturePositions,
        featureScores: source.posFeatureScores,
        numFeatures: source.posNumFeatures,
        color: posColor,
      })
    }
    if (source.negNumFeatures > 0) {
      layers.push({
        featurePositions: source.negFeaturePositions,
        featureScores: source.negFeatureScores,
        numFeatures: source.negNumFeatures,
        color: negColor,
      })
    }
    return layers
  }
}

// The shape of `model.gpuProps` — single source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. installPerRegionLifecycle's encode step reads `self.gpuProps()`, so
// a change re-fires every per-region autorun and re-uploads without an RPC
// roundtrip.
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
  // even when an earlier source is missing from the RPC payload. Overlay
  // collapses every source onto row 0 and colors neg features with the source's
  // pos color so overlapping sources stay visually one color.
  for (let i = 0; i < orderedSources.length; i++) {
    const orderedSource = orderedSources[i]!
    const source = sourcesByName.get(orderedSource.name)
    if (source) {
      const posColor = orderedSource.color
        ? cssColorToNormalizedRgb(orderedSource.color)
        : defaultPosColor
      const row = overlay ? 0 : i
      // Intentional and settled (see ADR-016): in row mode the neg side keeps
      // the shared defaultNegColor even when the source has a per-row color, so
      // signed data still reads as a pos/neg bicolor plot. Do NOT "fix" this to
      // paint the whole row in the per-source color — that split is by design
      // and the pos/neg partition stays worker-side.
      const layers = sourceLayers({
        source,
        summaryScoreMode,
        isDensityMode,
        scatter,
        posColor,
        negColor: overlay ? posColor : defaultNegColor,
      })
      for (const layer of layers) {
        result.push({ ...layer, rowIndex: row })
      }
    }
  }

  return result
}
