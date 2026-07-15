import type { MafColorPalette } from './util.ts'
import type { AlignmentContext, MafStatus } from '../types.ts'
import type { Canvas2DCoverageBuffer } from '@jbrowse/alignments-core'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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
  // Per-row species coords + context, retained for hover tooltips only (the
  // per-base color encoder and coverage code ignore them). Optional because
  // they are tooltip metadata, not needed to render.
  chr?: string
  start?: number
  strand?: number
  srcSize?: number
  context?: AlignmentContext
}

// A bridged/empty row (MAF `e` line): the species has no aligned bases in this
// block but its flanking blocks are chained. Drawn as a single/double line or
// pale bar across the block's reference extent (see emptyLines.ts).
export interface MafEmptyRow {
  rowIndex: number
  status: MafStatus
  chr: string
  start: number
  size: number
  strand: number
  srcSize: number
}

export interface MafBlock {
  startBp: number
  // Absolute genomic end (startBp + count of non-dash reference bytes). Lets
  // the e-line overlay span the block without re-walking refSeqBytes.
  endBp: number
  refSeqBytes: Uint8Array
  rows: MafAlignedRow[]
  empties: MafEmptyRow[]
}

// Per-region MAF coverage area data. `coverageDepths[i]` covers
// `[coverageStartPos + i, coverageStartPos + i + 1)` as an absolute genomic
// uint32; `coverageMaxDepth` is the per-region max used to scale the SNP bar
// height. The packed buffers are produced in the worker via the alignments-core
// packers and consumed by alignments-core `drawCoverageBins` / `drawSnpSegments`
// on the main thread — no per-region re-pack on theme/zoom changes. The MAF
// coverage band is Canvas2D-only, so `coveragePackedBuffer` carries the Canvas2D
// layout brand (raw depth), not the GPU `relDepth` layout.
//
// `mismatchPositions` / `mismatchBases` mirror the alignments worker's
// MismatchArrays shape so alignments-core's `buildCoverageTooltipBin` /
// `countSnpsAtPosition` can consume the data unchanged for hover tooltips.
// `insertionPositions` / `insertionLengths` likewise mirror the InterbaseArrays
// shape, feeding the insertion summary in the coverage-band tooltip (one entry
// per insertion, anchored at the reference position following the inserted run).
//
// `identityScores[i]` is the percent identity (0..1) at `coverageStartPos + i`:
// the fraction of aligned non-reference species matching the reference base,
// `NaN` where unclassifiable (depth 0 or ref `N`). Shipped raw (parallel to
// `coverageDepths`, shares `coverageStartPos`) — the conservation band draws it
// directly with per-pixel aggregation, the tooltip reads the exact value.
export interface MafCoverageRegion {
  coverageDepths: Float32Array
  coverageStartPos: number
  coverageMaxDepth: number
  identityScores: Float32Array
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  insertionPositions: Uint32Array
  insertionLengths: Uint32Array
  coveragePackedBuffer: Canvas2DCoverageBuffer
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
// installed by `startRenderingBackend`, so color/style settings never
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
// GPU can check presence). RenderData thus diverges from UploadData — the same
// shape LinearMultiRowFeatureDisplay uses; most per-region plugins instead keep
// the default `RenderData = UploadData`.
export type MafRenderingBackend = PerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
>
