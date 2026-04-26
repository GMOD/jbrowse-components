import type { ColorPalette } from './shaders/colors.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ArcColorByType } from '../../shared/types.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
export type { ColorPalette, RGBColor } from './shaders/colors.ts'

export interface BaseRegionData {
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
}

export function buildReadIdToIndex(ids: string[], n: number) {
  const m = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    m.set(ids[i]!, i)
  }
  return m
}

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
  arcColorByType?: ArcColorByType
  // Genomic bp that map to the arcs band's vertical extent. Arc/bezier mode
  // passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. See arc.slang `arcsYDomainBp`.
  arcsYDomainBp?: number
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
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColorTypes: Uint8Array
  numLines: number
}

export interface ConnectingLinesUploadData {
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  numConnectingLines: number
}

export interface AlignmentsSources {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
}

export interface AlignmentsBackend {
  sync(sources: AlignmentsSources): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): boolean
  dispose(): void
}

export type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export function ensureRegion<T>(
  regions: Map<number, T>,
  idx: number,
  factory: () => T,
): T {
  let r = regions.get(idx)
  if (!r) {
    r = factory()
    regions.set(idx, r)
  }
  return r
}

export function computeBlockHeights(state: RenderState) {
  return {
    effectiveArcsHeight:
      state.showArcs && state.arcsHeight ? state.arcsHeight : 0,
    covH: state.showCoverage ? state.coverageHeight : 0,
  }
}

// Canvas Y for a pileup row index, mirroring shader-side `pileupY()` in
// alignmentsUniforms.slang. Single source of truth for the row → canvas-Y
// formula used by every Canvas2D draw method.
export function pileupRowY(yRow: number, state: RenderState) {
  return (
    yRow * (state.featureHeight + state.featureSpacing) +
    state.pileupTopOffset -
    state.rangeY[0]
  )
}
