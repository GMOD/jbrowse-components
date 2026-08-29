// Worker → main-thread upload-data shapes, plus the `interbaseRangeEnds`
// helper that slices the merged interbase array. These are structural
// subsets of `PileupDataResult` (RenderAlignmentDataRPC/types.ts); duck-typing
// lets per-feature `buildRegion` / `pack` functions accept any object with
// the right fields, including the test fixtures and SVG-export shims.
//
// Lives in `shared/` so per-feature folders and shared orchestrators
// (`features/clip/packGpu.ts`, `runCoveragePipeline.ts`) don't have to import upward
// into `LinearAlignmentsDisplay/components/`.

import type { InsertSizeBand } from './insertSizeStats.ts'
import type { ReadKeys } from './readIdentity.ts'

export interface ReadUploadData {
  readPositions: Uint32Array
  readYs: Uint16Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint32Array
  readColorCategories: Uint8Array
  readInterchrom: Uint8Array // 1 = mate on a different chromosome
  readKeys: ReadKeys
  readIdPrefix: string | undefined
  maxY: number
  insertSizeStats?: InsertSizeBand
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
  numSegments: number
}

// The merged interbase array plus the three counts that partition it. Its own
// interface because it is what the insertion and clip marks read, and all three
// of their consumers now read the same one: the GPU packer, the Canvas2D
// painter (`Canvas2DRegionData` extends this rather than carrying nine
// pre-sliced fields) and the hit test. Each mark states its own slice through
// `rangeStart`/`rangeEnd` — see `features/mark.ts`.
export interface InterbaseUploadData {
  interbasePositions: Uint32Array
  interbaseYs: Uint16Array
  interbaseLengths: Uint32Array
  interbaseFrequencies: Uint8Array
  numInsertions: number
  numSoftclips: number
  numHardclips: number
}

export interface CigarUploadData extends InterbaseUploadData {
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
  mismatchQuals: Uint8Array
  interbaseTypes: Uint8Array
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
}

// Coverage-area upload payload. `coverageDepths` is the per-bp array the hit
// test, tooltip and autoscale read; every SEGMENT layer is its `*PackedBuffer`
// alone — one GPU-layout buffer per pass, produced by the RPC worker (see
// plugins/alignments/src/shared/packCoverageArea.ts and ADR-004), uploaded
// directly by the GPU renderer and read in place by the Canvas2D draw, the SVG
// export and the interbase hit test.
export interface CoverageUploadData {
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number
  // Width in bp of each record in coveragePackedBuffer, and the number of
  // records in it. Decoupled from coverageDepths.length: the GPU depth bars are
  // downsampled to a fixed bin cap (packCoverageArea) so the buffer tracks
  // screen pixels, while coverageDepths stays per-bp for hit-test / stats.
  coverageBinSize: number
  coverageGpuBinCount: number
  coveragePackedBuffer: ArrayBuffer
  // SNP yOffset/segHeight are fractions of THIS position's coverage bar;
  // relDepth = totalDepthAtPos / regionMaxDepth scales the bar at draw time.
  snpPackedBuffer: ArrayBuffer
  // The denominator the interbase stack fractions were baked against — the
  // region's peak read depth, or 0 for no interbase events at all. Not
  // derivable from the buffer, so it travels beside it.
  interbaseMaxCount: number
  interbasePackedBuffer: ArrayBuffer
  indicatorPackedBuffer: ArrayBuffer
}

export interface ModCoverageUploadData {
  // see CoverageUploadData.snpPackedBuffer for the fraction contract
  modCovPackedBuffer: ArrayBuffer
}

// Worker lays out interbases as (insertions, softclips, hardclips); the three
// counts let consumers slice their own subrange via `subarray`.
export function interbaseRangeEnds(data: {
  numInsertions: number
  numSoftclips: number
  numHardclips: number
}) {
  const insEnd = data.numInsertions
  const scEnd = insEnd + data.numSoftclips
  const hcEnd = scEnd + data.numHardclips
  return { insEnd, scEnd, hcEnd }
}
