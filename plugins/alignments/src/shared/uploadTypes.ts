// Worker → main-thread upload-data shapes, plus the `interbaseRangeEnds`
// helper that slices the merged interbase array. These are structural
// subsets of `PileupDataResult` (RenderPileupDataRPC/types.ts); duck-typing
// lets per-feature `buildRegion` / `pack` functions accept any object with
// the right fields, including the test fixtures and SVG-export shims.
//
// Lives in `shared/` so per-feature folders and shared orchestrators
// (`clipPass.ts`, `runCoveragePipeline.ts`) don't have to import upward
// into `LinearAlignmentsDisplay/components/`.

export interface ReadUploadData {
  readPositions: Uint32Array
  readYs: Uint16Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint32Array
  readChainHasSupp?: Uint8Array
  readIds: string[]
  maxY: number
  insertSizeStats?: { upper: number; lower: number }
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
  numSegments: number
}

export interface CigarUploadData {
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
  interbasePositions: Uint32Array
  interbaseYs: Uint16Array
  interbaseLengths: Uint16Array
  interbaseTypes: Uint8Array
  interbaseFrequencies: Uint8Array
  numInsertions: number
  numSoftclips: number
  numHardclips: number
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
}

// Coverage-area upload payload. Raw arrays are kept for hit testing / tooltip
// / Canvas2D rendering; the `*PackedBuffer` fields are pre-packed GPU-layout
// buffers produced by the RPC worker (see plugins/alignments/src/shared/
// packCoverageArea.ts and ADR-004) that the GPU renderer uploads directly.
export interface CoverageUploadData {
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number
  coveragePackedBuffer: ArrayBuffer
  snpPositions: Uint32Array
  // SNP yOffsets/heights are fractions of THIS position's coverage bar.
  // relDepth = totalDepthAtPos / regionMaxDepth scales the bar at draw time.
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Uint8Array
  snpRelDepths: Float32Array
  snpPackedBuffer: ArrayBuffer
  noncovPositions: Uint32Array
  noncovYOffsets: Float32Array
  noncovHeights: Float32Array
  noncovColorTypes: Uint8Array
  noncovMaxCount: number
  noncovPackedBuffer: ArrayBuffer
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  indicatorPackedBuffer: ArrayBuffer
}

export interface ModCoverageUploadData {
  modCovPositions: Uint32Array
  // see CoverageUploadData.snpRelDepths
  modCovYOffsets: Float32Array
  modCovHeights: Float32Array
  modCovColors: Uint32Array
  modCovRelDepths: Float32Array
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
