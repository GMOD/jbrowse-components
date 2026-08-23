import type { AlignmentContext, MafStatus } from '../types.ts'
import type { MafCoverageColors } from './coverageBandColors.ts'
import type { MafColorPalette } from './util.ts'
import type {
  CoverageBandBuffers,
  CoverageBandColors,
} from '@jbrowse/render-core/coverageBand'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type MafRenderBlock = RenderBlock

/**
 * The coverage band, when it has both a reason and an axis to draw against.
 * Absent means "draw no band": the setting is off, the summary tier owns the
 * view, or the autoscaled domain has not resolved yet — and the last of those is
 * why this is one nullable object rather than a height beside a nullable domain.
 * Every mark in the band is a fraction of `domainMax`, so a band drawn without
 * one is not a shorter band, it is bars of arbitrary height.
 */
export interface MafCoverageBandState {
  height: number
  domainMax: number
  /** CSS strings, for the Canvas2D fallback and the SVG export. */
  colors: MafCoverageColors
  /**
   * The same colours packed ABGR for the GPU passes. Carried rather than packed
   * in the renderer because `cssColorToABGR` parses, and the renderer would
   * run it nine times per block per frame — this is memoized off the palette.
   */
  gpuColors: CoverageBandColors
}

export interface MafGPURenderState {
  canvasWidth: number
  /**
   * The WHOLE canvas: the stacked bands above the rows plus the rows viewport.
   * The band stack and the rows are scissored out of one canvas, the way the
   * alignments display draws its coverage band and pileup — a display gets one
   * rendering backend, so a second GPU band cannot mean a second canvas.
   */
  canvasHeight: number
  /** Where the rows viewport starts inside the canvas (= `rowsTopOffset`). */
  rowsTop: number
  /** The rows *viewport*: rows past it are scrolled to, not grown into. */
  rowsHeight: number
  /** Absent when the band is not drawn — see `MafCoverageBandState`. */
  coverage: MafCoverageBandState | undefined
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
// genomic anchors.
//
// `MafWireRegionData` is what the worker emits, and it is **columnar**: one
// byte arena holding every sequence, plus parallel typed arrays of per-row and
// per-block fields, plus small string dictionaries. Nothing in it is per-row
// object structure. That shape is the whole reason the reply is affordable.
//
// The object-per-row shape this replaced put one `Uint8Array` on every row and
// every one of them in `postMessage`'s transfer list, and the cost of a
// transfer list is superlinear in its length: measured in Chrome at 26 species,
// a 3200-block region (83k rows, 10MB of sequence) blocked the worker inside
// `postMessage` for 3.3 SECONDS. Cloning those same buffers instead of
// transferring them took 159ms — at this granularity "zero-copy" was 20x slower
// than copying, because the per-entry bookkeeping dwarfs a 120-byte payload.
// Columnar makes the transfer list a fixed ~20 entries regardless of row count,
// and the same reply costs 0.03ms. Rows are rehydrated into the `MafBlock`
// shape below by `placeMafRegionData`, which already had to rebuild every row
// object to stamp `rowIndex` on it, so the rehydration is nearly free (measured
// 30ms -> 47ms at 83k rows) and no render, hit-test or measuring code changed.
//
// Adding a per-row field therefore means adding a parallel typed array here,
// never a property on a row object. Strings go through a dictionary
// (`sampleIds`/`chrNames`) so a repeated species or contig name is cloned once
// per region rather than once per row.
//
// Rows still name their species and nothing else — screen position is assigned
// on the main thread against the row list the display is actually drawing, so
// the worker never needs to know the display's order and a reorder cannot leave
// fetched rows pointing at another row's label.
export interface MafWireRegionData {
  /**
   * Every block's reference bytes and every row's aligned bytes, end to end.
   * A row's slice is `arena.subarray(rowOffset[i], rowOffset[i] + rowLength[i])`
   * and is only ever viewed, never copied, on the way to the GPU encoder.
   *
   * The reference is stored again as its own slice rather than aliasing the
   * reference species' row: that row is normally present but a `subtreeFilter`
   * can exclude it, and a malformed stanza can resolve no reference row at all.
   * It costs one row's bytes per block (~4% of the arena on a 26-way).
   */
  arena: Uint8Array

  // ---- per row, `rowCount` entries ----
  rowOffset: Uint32Array
  rowLength: Uint32Array
  /** index into `sampleIds` */
  rowSample: Uint32Array
  /** index into `chrNames` */
  rowChr: Uint32Array
  rowStart: Uint32Array
  /** +1/-1 */
  rowStrand: Int8Array
  /** total source sequence length; 0 when the adapter supplied none */
  rowSrcSize: Uint32Array

  /**
   * `i`-line context, present only when some adapter supplied it (bigMaf does,
   * MAF-tabix and TAF never do) so the other two ship nothing rather than five
   * zero-filled arrays. `rowHasContext[i]` is the presence flag — a row can
   * carry an `i` line whose statuses are both unrecognized, which is not the
   * same as carrying no `i` line. Statuses are `MAF_STATUS_WIRE` codes.
   */
  rowHasContext?: Uint8Array
  rowLeftStatus?: Uint8Array
  rowLeftCount?: Uint32Array
  rowRightStatus?: Uint8Array
  rowRightCount?: Uint32Array

  // ---- per block, `blockCount` entries ----
  blockStartBp: Uint32Array
  /**
   * Absolute genomic end (startBp + count of non-dash reference bytes). Lets
   * the e-line overlay span the block without re-walking the reference.
   */
  blockEndBp: Uint32Array
  blockRefOffset: Uint32Array
  blockRefLength: Uint32Array
  /**
   * Block `b` owns rows `blockRowStart[b] .. blockRowStart[b + 1]`, and
   * likewise for empties. Length `blockCount + 1`, so the last block needs no
   * special case.
   */
  blockRowStart: Uint32Array
  blockEmptyStart: Uint32Array

  // ---- per empty (`e`-line) row ----
  // A species with no aligned bases in this block whose flanking blocks are
  // chained. Drawn as a single/double line or pale bar across the block's
  // reference extent (see emptyLines.ts).
  emptySample: Uint32Array
  emptyChr: Uint32Array
  /** `MAF_STATUS_WIRE` code */
  emptyStatus: Uint8Array
  emptyStart: Uint32Array
  emptySize: Uint32Array
  emptyStrand: Int8Array
  emptySrcSize: Uint32Array

  // ---- dictionaries; small, so structured-cloned rather than transferred ----
  sampleIds: string[]
  chrNames: string[]

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
//
// These are what `placeMafRegionData` rehydrates the columnar wire into, and
// they are unchanged from when the wire itself was object-shaped — which is why
// the ~17 files downstream of placement were untouched by the switch.
export interface MafAlignedRow {
  rowIndex: number
  sampleId?: string
  /** a view into `MafWireRegionData.arena`, never a copy of it */
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

export interface MafEmptyRow {
  rowIndex: number
  sampleId?: string
  status: MafStatus
  chr: string
  start: number
  size: number
  strand: number
  srcSize: number
}

export interface MafBlock {
  startBp: number
  endBp: number
  /** a view into `MafWireRegionData.arena`, never a copy of it */
  refSeqBytes: Uint8Array
  rows: MafAlignedRow[]
  empties: MafEmptyRow[]
}

// Per-region MAF coverage area data. `coverageDepths[i]` covers
// `[coverageStartPos + i, coverageStartPos + i + 1)` as an absolute genomic
// uint32; `coverageMaxDepth` is the per-region max used to scale the SNP bar
// height. The packed buffers are produced in the worker via the alignments-core
// packers and uploaded verbatim to render-core's shared coverage-band passes —
// no per-region re-pack on theme/zoom changes.
//
// All four are the GPU layouts, and both backends draw off them: the depth bars
// have one buffer, not a GPU one beside a raw-depth Canvas2D one (see
// `drawCoverageBins`). `coverageDepths` stays for the hit test, the tooltip and
// the autoscale, which read a depth rather than draw a bar.
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
  coveragePackedBuffer: ArrayBuffer
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
// or the underlying `regionData` changes. The rows half is pre-encoded on the
// main thread because encoding depends on theme + user toggles (`MafGpuProps`);
// the coverage half is the worker's own packed buffers, carried through by
// reference so render-core's shared band passes can upload them verbatim.
export interface MafUploadPayload extends CoverageBandBuffers {
  // A typed array rather than a bare ArrayBuffer, so both HAL backends upload
  // exactly the encoded byte range. `InstanceWriter.finish` right-sizes it with
  // a copy rather than handing back a subarray of its over-allocation — the
  // payload is retained for as long as the region is loaded, and a view would
  // pin the dead tail with it.
  //
  // Being right-sized is also why there is no count beside it: the upload takes
  // the instance count off the bytes (`uploadPass`), so a second field could
  // only ever disagree.
  instanceBuffer: Uint32Array
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
