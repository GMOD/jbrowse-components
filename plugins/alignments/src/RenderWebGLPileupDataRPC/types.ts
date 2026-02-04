import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface RenderWebGLPileupDataArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
  region: {
    refName: string
    start: number
    end: number
    assemblyName?: string
  }
  filterBy?: Record<string, unknown>
  statusCallback?: (status: string) => void
  stopToken?: string
}

export interface WebGLPileupDataResult {
  // Reference point for all positions (stored as offsets from this)
  regionStart: number

  // Read data - positions are offsets from regionStart
  readPositions: Uint32Array // [startOffset, endOffset] pairs
  readYs: Uint16Array // pileup row (0-65535 sufficient)
  readFlags: Uint16Array // BAM flags are 16-bit
  readMapqs: Uint8Array // 0-255
  readInsertSizes: Float32Array // keep float (can be large/negative)

  // Gap data (deletions/skips) - offsets from regionStart
  gapPositions: Uint32Array // [startOffset, endOffset] pairs
  gapYs: Uint16Array

  // Mismatch data - offsets from regionStart
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array // 0=A, 1=C, 2=G, 3=T

  // Insertion data - offsets from regionStart
  insertionPositions: Uint32Array
  insertionYs: Uint16Array
  insertionLengths: Uint16Array

  // Soft clip data - offsets from regionStart
  softclipPositions: Uint32Array
  softclipYs: Uint16Array
  softclipLengths: Uint16Array

  // Hard clip data - offsets from regionStart
  hardclipPositions: Uint32Array
  hardclipYs: Uint16Array
  hardclipLengths: Uint16Array

  // Coverage data - positions computed from regionStart + index * binSize
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageBinSize: number

  // SNP coverage data - offsets from regionStart
  snpPositions: Uint32Array
  snpYOffsets: Float32Array // normalized 0-1
  snpHeights: Float32Array // normalized 0-1
  snpColorTypes: Uint8Array // 1=A, 2=C, 3=G, 4=T

  // Noncov (interbase) coverage data - insertion/softclip/hardclip counts by position
  // Bars grow downward from top of coverage area
  noncovPositions: Uint32Array // offsets from regionStart
  noncovYOffsets: Float32Array // cumulative height below this segment (normalized 0-1)
  noncovHeights: Float32Array // height of this segment (normalized 0-1)
  noncovColorTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip
  noncovMaxCount: number // max total count at any position (for scaling)

  // Interbase indicator data - triangles at significant positions
  indicatorPositions: Uint32Array // offsets from regionStart
  indicatorColorTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip (dominant type)

  // Layout info
  maxY: number
  numReads: number
  numGaps: number
  numMismatches: number
  numInsertions: number
  numSoftclips: number
  numHardclips: number
  numCoverageBins: number
  numSnpSegments: number
  numNoncovSegments: number
  numIndicators: number
}
