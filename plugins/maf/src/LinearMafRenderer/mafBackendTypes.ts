import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type MafRenderBlock = RenderBlock

export interface MafGPURenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
}

// Per-region alignment data returned from the RPC and stored in rpcDataMap.
// Heavy sequence data is encoded as Uint8Array for zero-copy transfer.
export interface MafAlignedRow {
  sampleId: string
  rowIndex: number
  // alignment encoded as ASCII Uint8Array (transferable, same chars as alignment string)
  alignmentBytes: Uint8Array
  alignmentStart: number  // absolute genomic start of sample alignment
  chr: string
}

export interface MafRegionData {
  startBp: number
  endBp: number
  // Reference sequence as Uint8Array (transferable)
  refSeqBytes: Uint8Array
  rows: MafAlignedRow[]
}

export interface MafBackend {
  // instanceBuffer: pre-encoded GPU instances (zero-copy from RPC)
  uploadRegion(
    displayedRegionIndex: number,
    instanceBuffer: ArrayBuffer,
    instanceCount: number,
    regionData: MafRegionData,
  ): void
  pruneRegions(active: number[]): void
  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState): void
  dispose(): void
}
