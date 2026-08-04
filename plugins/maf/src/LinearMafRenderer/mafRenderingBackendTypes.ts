import type { AlignmentContext, MafStatus } from '../types.ts'
import type { MafColorPalette } from './util.ts'
import type { Canvas2DCoverageBuffer } from '@jbrowse/alignments-core'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type MafRenderBlock = RenderBlock

export interface MafGPURenderState {
  canvasWidth: number
  /** the rows *viewport*: rows past it are scrolled to, not grown into */
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  /** rows-area scroll offset; every layer paints row i at `rowHeight*i - this` */
  scrollTop: number
  showAllLetters: boolean
  mismatchRendering: boolean
  /**
   * Full theme-derived color set (base palette + match/gap/mismatch/unknown/
   * insertion). Consumed by the Canvas2D fallback's `drawMafBlocks` so that
   * theme changes flow into rendering without hardcoded fallbacks.
   */
  palette: MafColorPalette
  /**
   * Genomic bp per painted cell (see `MafGpuProps.binBp`). Carried here too so
   * the Canvas2D fallback and the SVG export decimate identically to the GPU
   * encoder rather than emitting a rect per base at every zoom.
   */
  binBp: number
}

// One MAF "block" is a single ungapped alignment stanza emitted by the
// adapter; one region may contain many disjoint blocks at different
// genomic anchors. Heavy sequence data is Uint8Array for zero-copy transfer.
//
// The `Wire*` shapes are what the worker emits: rows name their species and
// nothing else. Screen position is assigned on the main thread by
// `placeMafRegionData`, against the row list the display is actually drawing —
// so the worker never needs to know the display's order, and a reorder cannot
// leave fetched rows pointing at another row's label.
export interface MafWireRow {
  sampleId: string
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
export interface MafWireEmptyRow {
  sampleId: string
  status: MafStatus
  chr: string
  start: number
  size: number
  strand: number
  srcSize: number
}

export interface MafWireBlock {
  startBp: number
  // Absolute genomic end (startBp + count of non-dash reference bytes). Lets
  // the e-line overlay span the block without re-walking refSeqBytes.
  endBp: number
  refSeqBytes: Uint8Array
  rows: MafWireRow[]
  empties: MafWireEmptyRow[]
}

export interface MafWireRegionData {
  blocks: MafWireBlock[]
  coverage: MafCoverageRegion
  /**
   * The sample whose row the reference sequence came from, resolved by the
   * worker (`referenceSampleId`) rather than assumed to be the view's assembly
   * name. Shipped because the conservation metric excludes the reference's
   * trivial self-match, and the two bands compute that metric in different
   * places — the per-base one in the worker, the codon one on the client — so
   * they have to agree on which row is the reference. Undefined when no block
   * resolved one.
   */
  refSampleId?: string
}

// Placed counterparts: `rowIndex` is the on-screen row, valid only against the
// `sources` list it was placed with. Everything that draws, hit-tests or
// measures rows consumes these, and keys on `rowIndex` alone — `sampleId` rides
// along as provenance, so it stays optional here rather than becoming a second
// row identity the render path could disagree with.
export interface MafAlignedRow extends Omit<MafWireRow, 'sampleId'> {
  rowIndex: number
  sampleId?: string
}

export interface MafEmptyRow extends Omit<MafWireEmptyRow, 'sampleId'> {
  rowIndex: number
  sampleId?: string
}

export interface MafBlock extends Omit<MafWireBlock, 'rows' | 'empties'> {
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
  /** see `MafWireRegionData.refSampleId` — placement doesn't touch it */
  refSampleId?: string
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
  /**
   * Genomic bp per emitted cell — `1` for the exact per-base encode, a larger
   * power of two once cells go sub-pixel (see `encodeBinBp`). Quantized so
   * zooming re-encodes only when it crosses a tier, not on every wheel tick.
   */
  binBp: number
}

// Payload the per-region autorun ships to the backend each time `gpuProps`
// or the underlying `regionData` changes. Pre-encoded on the main thread
// because encoding depends on theme + user toggles (`MafGpuProps`).
export interface MafUploadPayload {
  // A view, not a bare ArrayBuffer: the encoder over-allocates and hands back
  // a subarray, and both HAL backends upload only the view's byte range.
  instanceBuffer: Uint32Array
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
