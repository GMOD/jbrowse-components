import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ColorPalette } from './shaders/colors.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

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
  coverageNicedMax: number | undefined // niced domain max from D3 scale (matches Y scalebar labels)
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

export interface RenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export interface ReadUploadData {
  regionStart: number
  readPositions: Uint32Array
  readYs: Uint16Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint8Array
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
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  numSoftclipBases: number
}

export interface ModificationUploadData {
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint8Array
  numModifications: number
}

export interface CoverageUploadData {
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartOffset: number
  numCoverageBins: number
  snpPositions: Uint32Array
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Uint8Array
  numSnpSegments: number
  noncovPositions: Uint32Array
  noncovYOffsets: Float32Array
  noncovHeights: Float32Array
  noncovColorTypes: Uint8Array
  noncovMaxCount: number
  numNoncovSegments: number
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  numIndicators: number
}

export interface ModCoverageUploadData {
  modCovPositions: Uint32Array
  modCovYOffsets: Float32Array
  modCovHeights: Float32Array
  modCovColors: Uint8Array
  numModCovSegments: number
}

export interface ArcsUploadData {
  regionStart: number
  arcX1: Float32Array
  arcX2: Float32Array
  arcColorTypes: Float32Array
  arcIsArc: Uint8Array
  numArcs: number
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColorTypes: Float32Array
  numLines: number
}

export interface ConnectingLinesUploadData {
  regionStart: number
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  connectingLineColorTypes: Uint8Array
  numConnectingLines: number
}

export interface AlignmentsBackend {
  pruneRegions(activeRegions: number[]): void
  uploadRegion(regionNumber: number, data: PileupDataResult): void
  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: ArcsUploadData,
  ): void
  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: ConnectingLinesUploadData,
  ): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): void
  dispose(): void
}
