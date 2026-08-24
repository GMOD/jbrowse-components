import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_XYPLOT,
  gapBreakLimit,
} from '@jbrowse/wiggle-core'

import {
  isOverlayMode,
  isScatterMode,
  renderingTypeToInt,
} from './wiggleComponentUtils.ts'
import { makeSummaryLayers } from './wiggleLayers.ts'

import type { WiggleLayer } from './wiggleLayers.ts'
import type {
  SourceRenderData,
  WiggleDataResult,
  WiggleSourceData,
} from '@jbrowse/wiggle-core'

// The render layers one source contributes, chosen by summaryScoreMode but
// independent of where the source sits on screen. buildSourceRenderData stamps
// each with a rowIndex afterward, keeping row-placement in one place.
function sourceLayers({
  source,
  summaryScoreMode,
  isDensityMode,
  scatter,
  filled,
  posColor,
  negColor,
  pivot,
}: {
  source: WiggleSourceData
  summaryScoreMode: string
  isDensityMode: boolean
  scatter: boolean
  filled: boolean
  posColor: [number, number, number]
  negColor: [number, number, number]
  pivot: number
}): WiggleLayer[] {
  // whiskers draws three bands, min/max the one the user picked; both are
  // colored by each value's own sign against the pivot, so signed data keeps
  // reading as pos/neg. The worker only splits `featureScores` (ADR-016), so
  // that partition is re-derived per band on the main thread — without it,
  // switching a signed track to Minimum turned its negative bars blue and cost
  // a diverging density heatmap the loss/gain split it is read by.
  //
  // Every other mode is 'avg'. Density is the one that gets there without the
  // user picking it, and the model resolves that (see
  // `effectiveSummaryScoreMode`, which is what gpuProps carries) rather than
  // this re-deciding it. The autoscale domain, the track menu's radio and the
  // tooltip all read that same resolved mode, so a copy of the rule here could
  // only drift from them.
  if (summaryScoreMode !== 'avg') {
    return makeSummaryLayers({
      data: source,
      summaryScoreMode,
      posColor,
      negColor,
      pivot,
      isScatter: scatter,
      isFilled: filled,
      isDensityMode,
    })
  }

  // avg: the worker's pos/neg split, each side colored by sign — no main-thread
  // partition needed. A solid color is encoded upstream by the worker placing
  // every feature in the pos arrays, so this same branch renders it as one
  // color.
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

// The shape of `model.gpuProps` — single source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. installUpload's encode step reads `self.gpuProps()`, so
// a change re-fires every per-region autorun and re-uploads without an RPC
// roundtrip.
export interface WiggleGpuProps {
  sources: { name: string; color?: string }[]
  posColor: string
  negColor: string
  // The mode actually drawn, never the raw config slot, since density has no
  // whiskers presentation and resolves to 'avg'. Named for the model getter
  // that produces it so a new caller cannot skip the resolution.
  // `sourceLayers` treats anything but 'avg' as a mode that draws bands.
  effectiveSummaryScoreMode: string
  renderingType: string
  isDensityMode: boolean
  // Threshold the whiskers bands are colored around, and the baseline bars
  // pivot on (= bicolorPivot). Present here *as well as* in rpcProps: the
  // worker owns the avg-path pos/neg split (ADR-016, so it stays in rpcProps
  // and a change refetches), but the whiskers bands are colored on the main
  // thread and need the same threshold.
  bicolorPivot: number
  // How many mean point spacings apart two interpolated-line points may be
  // before the span counts as a hole (see gapBreakLimit). Lives in gpuProps,
  // not the render state, because the break is baked into the instance buffer
  // at encode time — so a change re-fires the per-region autorun and re-uploads
  // rather than needing a shader uniform.
  maxGapMultiple: number
}

// The center-to-center bp distance at which the interpolated line stops
// connecting. Both backends read the single number computed here rather than
// deriving their own, so an encoded break and a drawn break can't disagree.
// Only linecenter connects across bins at all, so every other rendering leaves
// it undefined and pays nothing.
function layerGapLimitBp(
  featurePositions: Uint32Array,
  numFeatures: number,
  multiple: number,
  isLineCenter: boolean,
) {
  if (!isLineCenter || numFeatures < 3) {
    return undefined
  }
  const last = (numFeatures - 1) * 2
  return gapBreakLimit({
    first: (featurePositions[0]! + featurePositions[1]!) / 2,
    last: (featurePositions[last]! + featurePositions[last + 1]!) / 2,
    count: numFeatures,
    multiple,
  })
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  gpuProps: WiggleGpuProps,
): SourceRenderData[] {
  const {
    sources,
    posColor: defaultPosColorStr,
    negColor: defaultNegColorStr,
    effectiveSummaryScoreMode: summaryScoreMode,
    renderingType,
    isDensityMode,
    bicolorPivot,
    maxGapMultiple,
  } = gpuProps
  const overlay = isOverlayMode(renderingType)
  const scatter = isScatterMode(renderingType)
  const renderingTypeInt = renderingTypeToInt(renderingType)
  const lineCenter = renderingTypeInt === RENDERING_TYPE_LINE_CENTER
  // Filled bars (xyplot, incl. multi-row/overlay variants) need whiskers split
  // by sign for correct back-to-front stacking; line/scatter/density don't.
  const filled = renderingTypeInt === RENDERING_TYPE_XYPLOT
  const defaultPosColor = cssColorToNormalizedRgb(defaultPosColorStr)
  const defaultNegColor = cssColorToNormalizedRgb(defaultNegColorStr)
  const sourcesByName = new Map(data.sources.map(s => [s.name, s]))
  const result: SourceRenderData[] = []

  // `sources` is the display's own visible list and the only thing iterated —
  // never the payload's. rowIndex is the source's position in it, so it lines up
  // with the model's numSources-based rowHeight and findHit's
  // visibleSources[rowIdx], even when an earlier source is missing from the RPC
  // payload. An empty list therefore draws nothing, which is what a subtree
  // filter matching no present source means; falling back to the payload there
  // painted its first source full-height underneath the "no subtracks match"
  // message. Overlay collapses every source onto row 0 and colors neg features
  // with the source's pos color so overlapping sources stay visually one color.
  for (let i = 0; i < sources.length; i++) {
    const orderedSource = sources[i]!
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
        filled,
        posColor,
        negColor: overlay ? posColor : defaultNegColor,
        pivot: bicolorPivot,
      })
      for (const layer of layers) {
        result.push({
          ...layer,
          rowIndex: row,
          renderingType: renderingTypeInt,
          gapLimitBp: layerGapLimitBp(
            layer.featurePositions,
            layer.numFeatures,
            maxGapMultiple,
            lineCenter,
          ),
        })
      }
    }
  }

  return result
}
