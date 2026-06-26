import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type MultiRowRenderBlock = RenderBlock

// Per-region feature data shipped by the worker (LinearMultiRowGetFeatures).
// Positions are absolute genomic uint32; colors are pre-resolved ABGR. Rows are
// referenced indirectly: `partitionValues` lists the distinct row keys seen in
// this region and `featurePartitionIndex[i]` indexes into it, so the main thread
// can remap to a global, stable row index without re-shipping strings per
// feature.
export interface MultiRowRegionData {
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  partitionValues: string[]
  featurePartitionIndex: Uint32Array
  // per-feature display name, for hover tooltips (render path ignores it)
  featureNames: string[]
}

export interface MultiRowRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  // value -> global row index. Used by the Canvas2D fallback, which draws from
  // the raw region data and so resolves each feature's row here (the GPU path
  // bakes the row index into its uploaded buffer and ignores this).
  rowIndexByValue: ReadonlyMap<string, number>
  // per-row color override (ABGR) by global row index, from the arrangement
  // dialog; `undefined` rows use the worker-baked per-feature color. The GPU
  // path bakes this into its buffer and ignores it here.
  rowColorsByIndex?: readonly (number | undefined)[]
}

// Pre-encoded GPU instance buffer ({startBp,endBp,rowIndex,color} per feature),
// built on the main thread so a row reorder / recolor re-encodes without an RPC
// roundtrip. Diverges from `MultiRowRegionData` (the render side reads the raw
// region data); mirrors MAF.
export interface MultiRowUploadPayload {
  instanceBuffer: ArrayBuffer
  instanceCount: number
}

export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  MultiRowRenderBlock,
  MultiRowRegionData
>
