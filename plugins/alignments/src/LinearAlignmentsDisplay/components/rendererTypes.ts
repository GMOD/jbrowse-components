import type { ColorPalette } from './shaders/colors.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
export type { ColorPalette, RGBColor } from './shaders/colors.ts'

export interface RenderState {
  bpRangeX: [number, number] // absolute genomic positions
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number // padding at top/bottom of coverage area for scalebar labels
  coverageMaxDepth: number | undefined
  coverageIsLog: boolean
  showMismatches: boolean
  showSoftClipping: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  highlightedFeatureId?: string
  selectedFeatureId?: string
  highlightedChainIds: string[]
  selectedChainIds: string[]
  // Color palette from theme
  colors: ColorPalette
  renderingMode?: 'pileup' | 'linkedRead'
  flipStrandLongReadChains?: boolean
  reversed?: boolean
  arcLineWidth?: number
  // Show arcs alongside pileup (between coverage and reads)
  showArcs?: boolean
  arcsHeight?: number
  pairedArcsDown: boolean
  pileupTopOffset: number
  showOutline?: boolean
}

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
  numReads: number
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
  numGaps: number
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
  numMismatches: number
  interbasePositions: Uint32Array
  interbaseYs: Uint16Array
  interbaseLengths: Uint16Array
  interbaseTypes: Uint8Array
  interbaseFrequencies: Uint8Array
  numInterbases: number
  numInsertions: number
  numSoftclips: number
  numHardclips: number
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  numSoftclipBases: number
}

export interface ModificationUploadData {
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint32Array
  numModifications: number
}

// Coverage-area upload payload. Raw arrays are kept for hit testing / tooltip
// / Canvas2D rendering; the `*PackedBuffer` fields are pre-packed GPU-layout
// buffers produced by the RPC worker (see plugins/alignments/src/shared/
// packCoverageArea.ts and ADR-004) that the GPU renderer uploads directly.
export interface CoverageUploadData {
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number
  numCoverageBins: number
  coveragePackedBuffer: ArrayBuffer
  snpPositions: Uint32Array
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Uint8Array
  numSnpSegments: number
  snpPackedBuffer: ArrayBuffer
  noncovPositions: Uint32Array
  noncovYOffsets: Float32Array
  noncovHeights: Float32Array
  noncovColorTypes: Uint8Array
  noncovMaxCount: number
  numNoncovSegments: number
  noncovPackedBuffer: ArrayBuffer
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  numIndicators: number
  indicatorPackedBuffer: ArrayBuffer
}

export interface ModCoverageUploadData {
  modCovPositions: Uint32Array
  modCovYOffsets: Float32Array
  modCovHeights: Float32Array
  modCovColors: Uint32Array
  numModCovSegments: number
  modCovPackedBuffer: ArrayBuffer
}

export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Float32Array
  arcIsArc: Uint8Array
  numArcs: number
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColorTypes: Float32Array
  numLines: number
}

export interface ConnectingLinesUploadData {
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  numConnectingLines: number
}

export interface AlignmentsBackend {
  pruneRegions(activeRegions: number[]): void
  uploadRegion(displayedRegionIndex: number, data: PileupDataResult): void
  uploadArcsFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: ArcsUploadData,
  ): void
  uploadConnectingLinesForRegion(
    displayedRegionIndex: number,
    data: ConnectingLinesUploadData,
  ): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): void
  dispose(): void
}

export type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
