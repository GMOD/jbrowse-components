import type { SpanChannels } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'

// The three inputs to "does this feature paint, and in what color". All three
// are required, because `featurePainting` reads them together and the rule
// inverts if one goes missing.
export interface MultiRowFeaturePaintInputs {
  // partition value -> global row index
  rowIndexByValue: ReadonlyMap<string, number>
  // ABGR per-row override by global row index; `undefined` entries paint the
  // worker-baked per-feature color
  rowColorsByIndex: readonly (number | undefined)[]
  // ABGR colors of legend categories toggled off; matching features are omitted
  // at encode time and so reach neither backend
  hiddenColors: ReadonlySet<number>
}

export interface MultiRowRenderState extends MultiRowFeaturePaintInputs {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
}

// The `span` channels are encoded on the main thread, so a row reorder,
// recolor or category toggle re-encodes without an RPC roundtrip.
export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  SpanChannels,
  MultiRowRenderState
>
