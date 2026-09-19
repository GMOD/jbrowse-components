import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  gapBreakLimit,
} from '@jbrowse/wiggle-core'

import { renderingTypeToInt } from './wiggleComponentUtils.ts'
import { lineLayers, makeSummaryLayers } from './wiggleLayers.ts'

import type { WiggleLayer } from './wiggleLayers.ts'
import type {
  SourceRenderData,
  WiggleDataResult,
  WiggleRenderingType,
  WiggleSourceData,
} from '@jbrowse/wiggle-core'

// The render layers one source contributes, chosen by summaryScoreMode but
// independent of where the source sits on screen. buildSourceRenderData stamps
// each with a rowIndex afterward, keeping row-placement in one place.
function sourceLayers({
  source,
  summaryScoreMode,
  renderingType,
  posColor,
  negColor,
  pivot,
}: {
  source: WiggleSourceData
  summaryScoreMode: string
  renderingType: WiggleRenderingType
  posColor: [number, number, number]
  negColor: [number, number, number]
  pivot: number
}): WiggleLayer[] {
  if (
    renderingType === RENDERING_TYPE_LINE ||
    renderingType === RENDERING_TYPE_LINE_CENTER
  ) {
    return lineLayers(source, summaryScoreMode, posColor, negColor)
  }
  // whiskers draws min, mean and max, min/max the one band the user picked,
  // avg the mean alone; every one of them is coloured by each value's own sign
  // against the pivot, so signed data reads as pos/neg on the main thread.
  //
  // Density is the one mode that gets to 'avg' without the user picking it, and
  // the model resolves that (see `effectiveSummaryScoreMode`, which is what
  // gpuProps carries) rather than this re-deciding it. The autoscale domain,
  // the track menu's radio and the tooltip all read that same resolved mode, so
  // a copy of the rule here could only drift from them.
  return makeSummaryLayers({
    data: source,
    summaryScoreMode,
    posColor,
    negColor,
    pivot,
    renderingType,
  })
}

// The shape of `model.gpuProps` — single source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. installUpload's encode step reads `self.gpuProps()`, so
// a change re-fires every per-region autorun and re-uploads without an RPC
// roundtrip.
export interface WiggleGpuProps {
  sources: { name: string; color?: string }[]
  // Whether the display sections its sources, one row each (`facet: 'source'`).
  // Unfaceted, every source is drawn on row 0 in one shared plot.
  faceted: boolean
  posColor: string
  negColor: string
  // The mode actually drawn, never the raw config slot, since density has no
  // whiskers presentation and resolves to 'avg'. Named for the model getter
  // that produces it so a new caller cannot skip the resolution.
  effectiveSummaryScoreMode: string
  renderingType: string
  // Threshold every mode colors around, and the baseline bars pivot on
  // (= bicolorPivot). An encoder input alone: moving it re-encodes and
  // refetches nothing.
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

export function encodeWiggleRegions(model: {
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  gpuProps: () => WiggleGpuProps
}) {
  const gpuProps = model.gpuProps()
  const regions = new Map<number, SourceRenderData[]>()
  for (const [idx, data] of model.rpcDataMap) {
    regions.set(idx, buildSourceRenderData(data, gpuProps))
  }
  return regions
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  gpuProps: WiggleGpuProps,
): SourceRenderData[] {
  const {
    sources,
    faceted,
    posColor: defaultPosColorStr,
    negColor: defaultNegColorStr,
    effectiveSummaryScoreMode: summaryScoreMode,
    renderingType,
    bicolorPivot,
    maxGapMultiple,
  } = gpuProps
  // Several plots sharing one box have to read as one colour each, so the
  // sub-pivot side takes the source's own colour there. One plot in the box has
  // nothing to be told apart from, and is the pos/neg bicolor plot a
  // single-source quantitative track has always drawn.
  const sharedPlot = !faceted && sources.length > 1
  const renderingTypeInt = renderingTypeToInt(renderingType)
  const lineCenter = renderingTypeInt === RENDERING_TYPE_LINE_CENTER
  const defaultPosColor = cssColorToNormalizedRgb(defaultPosColorStr)
  const defaultNegColor = cssColorToNormalizedRgb(defaultNegColorStr)
  const sourcesByName = new Map(data.sources.map(s => [s.name, s]))
  const result: SourceRenderData[] = []
  // Every band ahead of every line, so Canvas2D paints them all underneath, as
  // the GPU composites them.
  const bands: SourceRenderData[] = []

  // `sources` is the display's own visible list and the only thing iterated —
  // never the payload's. rowIndex is the source's position in it, so it lines up
  // with the model's numSources-based rowHeight and findHit's
  // visibleSources[rowIdx], even when an earlier source is missing from the RPC
  // payload. An empty list therefore draws nothing, which is what a subtree
  // filter matching no present source means; falling back to the payload there
  // painted its first source full-height underneath the "no subtracks match"
  // message. Unfaceted, every source collapses onto row 0.
  for (let i = 0; i < sources.length; i++) {
    const orderedSource = sources[i]!
    const source = sourcesByName.get(orderedSource.name)
    if (source) {
      const posColor = orderedSource.color
        ? cssColorToNormalizedRgb(orderedSource.color)
        : defaultPosColor
      const row = faceted ? i : 0
      // Intentional and settled (see ADR-016): with a row each the neg side keeps
      // the shared defaultNegColor even when the source has a per-row color, so
      // signed data still reads as a pos/neg bicolor plot. Do NOT "fix" this to
      // paint the whole row in the per-source color.
      const layers = sourceLayers({
        source,
        summaryScoreMode,
        renderingType: renderingTypeInt,
        posColor,
        negColor: sharedPlot ? posColor : defaultNegColor,
        pivot: bicolorPivot,
      })
      for (const layer of layers) {
        const into = layer.band ? bands : result
        into.push({
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

  return bands.length > 0 ? [...bands, ...result] : result
}
