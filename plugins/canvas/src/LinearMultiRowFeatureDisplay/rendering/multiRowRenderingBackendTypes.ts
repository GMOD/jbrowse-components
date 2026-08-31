import type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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
// the encode autorun, the painters, the hit test and the row sort all take it.
export interface MultiRowFeaturePaintInputs {
  // value -> global row index. Used by the Canvas2D fallback, which draws from
  // the raw region data and so resolves each feature's row here (the GPU path
  // bakes the row index into its uploaded buffer and ignores this).
  rowIndexByValue: ReadonlyMap<string, number>
  // per-row color override (ABGR) by global row index, from the arrangement
  // dialog; `undefined` entries use the worker-baked per-feature color.
  rowColorsByIndex: readonly (number | undefined)[]
  // per-feature ABGR colors of legend categories toggled off; matching features
  // are skipped by the Canvas2D path and omitted by the GPU path at encode time.
  hiddenColors: ReadonlySet<number>
}

export interface MultiRowRenderState extends MultiRowFeaturePaintInputs {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
}

// Pre-encoded GPU instance buffer ({startBp,endBp,rowIndex,color} per feature),
// built on the main thread so a row reorder / recolor re-encodes without an RPC
// roundtrip. Diverges from `MultiRowRegionData` (the render side reads the raw
// region data); mirrors MAF.
// Right-sized by the encoder, which is why no count travels with it: the upload
// takes the instance count off the bytes (`uploadPass`).
export interface MultiRowUploadPayload {
  instanceBuffer: ArrayBuffer
}

export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  RenderBlock,
  MultiRowRegionData
>
