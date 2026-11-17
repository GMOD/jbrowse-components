import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from '@jbrowse/wiggle-core'

import { renderingTypeToInt } from './wiggleComponentUtils.ts'
import { lineLayers, makeSummaryLayers } from './wiggleLayers.ts'

import type { WiggleRendering } from '../renderingTypes.ts'
import type { ResolvedWiggleColor } from './wiggleColor.ts'
import type {
  Extent,
  SourceRenderData,
  SummaryField,
  WiggleDataResult,
} from '@jbrowse/wiggle-core'

// The shape of `model.gpuProps` — single source of truth for "settings that
// affect the per-instance GPU buffer encoding". buildSourceRenderData
// consumes this exact type, so TS forces gpuProps and the encoder to stay
// in sync. installUpload's encode step reads `self.gpuProps()`, so
// a change re-fires every per-region autorun and re-uploads without an RPC
// roundtrip.
// A source as the encoder draws it: the color its marks paint in, and the
// row it is drawn in — its own under `rows: 'source'`, its value's under a
// grouping field, row 0 in one shared plot.
export interface MarkSource {
  name: string
  label?: string
  color?: string
  row: number
}

export interface WiggleGpuProps {
  sources: MarkSource[]
  // The `color` object resolved: the pair each mode partitions by and the
  // value they part at.
  wiggleColor: ResolvedWiggleColor
  // The score filled bars grow from, which orders a band's layers.
  origin: number
  summaryField: SummaryField
  // The extent actually drawn, never the raw config slot, since density has
  // no min-max presentation and resolves to 'none'. Named for the model getter
  // that produces it so a new caller cannot skip the resolution.
  effectiveExtent: Extent
  renderingType: WiggleRendering
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
    wiggleColor,
    origin,
    summaryField,
    effectiveExtent: extent,
    renderingType,
  } = gpuProps
  const { cuts } = wiggleColor
  const innerColors = wiggleColor.innerColors.map(c =>
    cssColorToNormalizedRgb(c),
  )
  const renderingTypeInt = renderingTypeToInt(renderingType)
  const isLine =
    renderingTypeInt === RENDERING_TYPE_LINE ||
    renderingTypeInt === RENDERING_TYPE_LINE_CENTER
  const gradient = wiggleColor.rampLut !== null
  const defaultPosColor = cssColorToNormalizedRgb(wiggleColor.posColor)
  const defaultNegColor = cssColorToNormalizedRgb(wiggleColor.negColor)
  const sourcesByName = new Map(data.sources.map(s => [s.name, s]))
  const result: SourceRenderData[] = []
  // Every band ahead of every line, so Canvas2D paints them all underneath, as
  // the GPU composites them.
  const bands: SourceRenderData[] = []

  // `sources` is the display's own visible list and the only thing iterated —
  // never the payload's. rowIndex is the row the model placed the source in,
  // so it lines up with the model's numRows-based rowHeight and findHit's row
  // pick, even when an earlier source is missing from the RPC payload. An
  // empty list therefore draws nothing, which is what a subtree filter
  // matching no present source means; falling back to the payload there
  // painted its first source full-height underneath the "no subtracks match"
  // message.
  for (const orderedSource of sources) {
    const source = sourcesByName.get(orderedSource.name)
    if (source) {
      const posColor = orderedSource.color
        ? cssColorToNormalizedRgb(orderedSource.color)
        : defaultPosColor
      const { row } = orderedSource
      // A source's own color is the subtrack's, so it paints both sides of
      // the cut, where the y position already shows the sign; a source with
      // none paints the plot's pair (ADR-251).
      const negColor = orderedSource.color ? posColor : defaultNegColor
      // `extent` is the model's `effectiveExtent`, which already drops the
      // band density cannot draw, so it is not re-decided here
      const layers = isLine
        ? lineLayers(source, summaryField, extent, posColor, negColor)
        : makeSummaryLayers({
            data: source,
            summaryField,
            extent,
            posColor,
            negColor,
            origin,
            cuts,
            innerColors,
            renderingType: renderingTypeInt,
            gradient,
          })
      for (const layer of layers) {
        const into = layer.band ? bands : result
        into.push({
          ...layer,
          rowIndex: row,
          renderingType: renderingTypeInt,
          gapScore:
            !layer.band && renderingTypeInt === RENDERING_TYPE_LINE
              ? origin
              : undefined,
        })
      }
    }
  }

  return bands.length > 0 ? [...bands, ...result] : result
}
