import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type MafRenderBlock = RenderBlock

export interface MafGPURenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  mismatchRendering: boolean
  colorForBase: Record<string, string>
}

// One MAF "block" is a single ungapped alignment stanza emitted by the
// adapter; one region may contain many disjoint blocks at different
// genomic anchors. Heavy sequence data is Uint8Array for zero-copy transfer.
export interface MafAlignedRow {
  rowIndex: number
  alignmentBytes: Uint8Array
}

export interface MafBlock {
  startBp: number
  refSeqBytes: Uint8Array
  rows: MafAlignedRow[]
}

export interface MafRegionData {
  blocks: MafBlock[]
}

// Raw per-region RPC result, stored in `rpcDataMap`. The instance buffer is
// built on the main thread (see `installMafLifecycle`) from this plus the
// current `MafGpuProps`, so color/style settings never round-trip through
// the worker.
export interface MafRpcDataEntry {
  regionData: MafRegionData
}

// Inputs to `buildInstanceBuffer` — derived from theme + user toggles on
// the main thread. Changes here re-encode (without refetching).
export interface MafGpuProps {
  colorForBase: Record<string, string>
  showAllLetters: boolean
  mismatchRendering: boolean
}

// Payload the per-region autorun ships to the backend each time `gpuProps`
// or the underlying `regionData` changes.
export interface MafUploadPayload {
  instanceBuffer: ArrayBuffer
  instanceCount: number
  regionData: MafRegionData
}

export interface MafBackend {
  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload): void
  pruneRegions(active: number[]): void
  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState): void
  dispose(): void
}
