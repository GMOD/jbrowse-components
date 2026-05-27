import type { MafColorPalette } from './util.ts'
import type { PerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type MafRenderBlock = RenderBlock

export interface MafGPURenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  mismatchRendering: boolean
  /**
   * Full theme-derived color set (base palette + match/gap/mismatch/unknown/
   * insertion). Consumed by the Canvas2D fallback's `drawMafBlocks` so that
   * theme changes flow into rendering without hardcoded fallbacks.
   */
  palette: MafColorPalette
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

// Per-region MAF coverage area data. `coverageDepths[i]` covers
// `[coverageStartPos + i, coverageStartPos + i + 1)` as an absolute genomic
// uint32; `coverageMaxDepth` is the per-region max used to normalize the bar
// height in the GPU-packed buffer. The two packed buffers are produced in the
// worker via the alignments-core packers and consumed by alignments-core
// `drawCoverageBins` / `drawSnpSegments` on the main thread — no per-region
// re-pack on theme/zoom changes.
//
// `mismatchPositions` / `mismatchBases` mirror the alignments worker's
// MismatchArrays shape so alignments-core's `buildCoverageTooltipBin` /
// `countSnpsAtPosition` can consume the data unchanged for hover tooltips.
export interface MafCoverageRegion {
  coverageDepths: Float32Array
  coverageStartPos: number
  coverageMaxDepth: number
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  coveragePackedBuffer: ArrayBuffer
  snpPackedBuffer: ArrayBuffer
  interbasePackedBuffer: ArrayBuffer
  interbaseMaxCount: number
  indicatorPackedBuffer: ArrayBuffer
}

export interface MafRegionData {
  blocks: MafBlock[]
  coverage: MafCoverageRegion
}

// Inputs to `buildInstanceBuffer` — derived from theme + user toggles on
// the main thread. Changes here re-encode (without refetching). The
// instance buffer itself is built in the per-region encode autorun
// installed by `startBackend`, so color/style settings never
// round-trip through the worker.
export interface MafGpuProps {
  palette: MafColorPalette
  showAllLetters: boolean
  mismatchRendering: boolean
}

// Payload the per-region autorun ships to the backend each time `gpuProps`
// or the underlying `regionData` changes. Pre-encoded on the main thread
// because encoding depends on theme + user toggles (`MafGpuProps`).
export interface MafUploadPayload {
  instanceBuffer: ArrayBuffer
  instanceCount: number
}

// MAF uploads a pre-encoded GPU buffer; the render-side reads raw blocks
// directly from the model's `rpcDataMap` (so Canvas2D can draw them and
// GPU can check presence). RenderData diverges from UploadData here —
// every other per-region plugin keeps the default `RenderData = UploadData`.
export type MafBackend = PerRegionBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
>
