import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type MafRenderBlock = RenderBlock

export interface MafGPURenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  mismatchRendering: boolean
}

// Per-block alignment data. A MAF "block" is a single ungapped alignment
// stanza emitted by the adapter; one region may contain many disjoint blocks
// at different genomic anchors. Heavy sequence data uses Uint8Array for
// zero-copy transfer.
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

// Stored value type for the display's per-region rpcDataMap. Carries both the
// pre-encoded GPU instances (used by GpuMafRenderer) and the raw alignment
// blocks (used by Canvas2DMafRenderer and SVG export).
export interface MafRpcDataEntry {
  instanceBuffer: ArrayBuffer
  instanceCount: number
  regionData: MafRegionData
}

export interface MafBackend {
  uploadRegion(displayedRegionIndex: number, data: MafRpcDataEntry): void
  pruneRegions(active: number[]): void
  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState): void
  dispose(): void
}
