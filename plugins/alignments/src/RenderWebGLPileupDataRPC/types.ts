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
  // Read data
  readPositions: Float32Array // [start, end] pairs, length = numReads * 2
  readYs: Float32Array // pileup row for each read
  readFlags: Float32Array
  readMapqs: Float32Array
  readInsertSizes: Float32Array

  // Gap data (deletions/skips)
  gapPositions: Float32Array // [start, end] pairs
  gapYs: Float32Array

  // Mismatch data
  mismatchPositions: Float32Array
  mismatchYs: Float32Array
  mismatchBases: Float32Array // 0=A, 1=C, 2=G, 3=T

  // Insertion data
  insertionPositions: Float32Array
  insertionYs: Float32Array

  // Coverage data
  coveragePositions: Float32Array
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageBinSize: number

  // SNP coverage data
  snpPositions: Float32Array
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Float32Array // 1=A, 2=C, 3=G, 4=T

  // Layout info
  maxY: number
  numReads: number
  numGaps: number
  numMismatches: number
  numInsertions: number
  numCoverageBins: number
  numSnpSegments: number
}
