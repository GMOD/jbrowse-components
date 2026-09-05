import type { SpanChannels } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// The worker's own per-region shape, re-exported rather than aliased: the
// renderers want the feature arrays and not the size-gate fields the RPC result
// adds, and that distinction lives in rpcTypes.ts where the shape is defined.
export type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'

// The three inputs to "does this feature paint, and in what color" — always
// supplied together, because `featurePainting` reads them together and the rule
// inverts if one goes missing. Required rather than optional for that reason: an
// absent `rowColorsByIndex` used to mean "no row has an override", which is also
// what an empty array means, so the optionality bought a second spelling of one
// state and a `?.` at every use.
//
// Named rather than a `Pick` at each site: the model memoizes exactly this
// triple (`featurePaintInputs`) because it moves on a reorder / recolor /
// category toggle where the rest of the render state also moves on a resize, so
// the encode autorun, the indel overlay, the hit test and the row sort all take
// it.
export interface MultiRowFeaturePaintInputs {
  // value -> global row index, resolved by the encode into the `row` channel.
  rowIndexByValue: ReadonlyMap<string, number>
  // per-row color override (ABGR) by global row index, from the arrangement
  // dialog; `undefined` entries use the worker-baked per-feature color.
  rowColorsByIndex: readonly (number | undefined)[]
  // per-feature ABGR colors of legend categories toggled off; matching features
  // are omitted at encode time and so reach neither backend.
  hiddenColors: ReadonlySet<number>
}

export interface MultiRowRenderState extends MultiRowFeaturePaintInputs {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
}

// The `span` shape's channels, encoded on the main thread so a row reorder /
// recolor / category toggle re-encodes without an RPC roundtrip. Both backends
// read the same channels — the GPU packs them, the painter walks them — which
// is what the per-backend pair of walks over the raw region data used to be.
export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  SpanChannels,
  MultiRowRenderState
>
