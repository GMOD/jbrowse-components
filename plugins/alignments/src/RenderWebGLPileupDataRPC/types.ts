/**
 * WebGL Pileup Data RPC Types
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * regionStart must be an integer (use Math.floor of view region start).
 * All position arrays store integer offsets from regionStart.
 * This is critical for alignment between coverage, gaps, and rendered features.
 */

import type { SortedBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface RenderWebGLPileupDataArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
  region: {
    refName: string
    originalRefName?: string
    start: number
    end: number
    assemblyName?: string
  }
  filterBy?: Record<string, unknown>
  colorBy?: {
    type: string
    tag?: string
    modifications?: { threshold?: number }
  }
  colorTagMap?: Record<string, string>
  sortedBy?: SortedBy
  statusCallback?: (status: string) => void
  stopToken?: string
}

// Detailed tooltip data for a coverage position (SNPs + deletions + interbase)
// Note: Skips (splice junctions) appear in sashimi arc tooltips, not coverage tooltips
export interface CoverageTooltipBin {
  position: number // absolute genomic position
  depth: number // total reads at this position
  // SNP data: base -> { count, fwd, rev }
  snps: Record<string, { count: number; fwd: number; rev: number }>
  // Deletion data: { count, minLen, maxLen, avgLen }
  deletions?: {
    count: number
    minLen: number
    maxLen: number
    avgLen: number
  }
  skips?: {
    count: number
    minLen: number
    maxLen: number
    avgLen: number
  }
  // Interbase data: type -> { count, minLen, maxLen, avgLen, topSeq, topSeqCount }
  interbase: Record<
    string,
    {
      count: number
      minLen: number
      maxLen: number
      avgLen: number
      topSeq?: string
      topSeqCount?: number
    }
  >
  // Modification data: modType -> { count, fwd, rev, probabilityTotal, color, name }
  modifications?: Record<
    string,
    {
      count: number
      fwd: number
      rev: number
      probabilityTotal: number
      color: string
      name: string
    }
  >
}

// Internal type for modification data during processing
export interface ModificationEntry {
  featureId: string
  position: number
  base: string
  modType: string
  isSimplex: boolean
  strand: number
  r: number
  g: number
  b: number
  prob: number
}

export interface WebGLPileupDataResult {
  // Integer reference point for all positions (floor of view region start).
  // All position data in this result is stored as integer offsets from regionStart.
  regionStart: number

  // Read data - positions are offsets from regionStart
  readPositions: Uint32Array // [startOffset, endOffset] pairs
  readYs: Uint16Array // pileup row (0-65535 sufficient)
  readFlags: Uint16Array // BAM flags are 16-bit
  readMapqs: Uint8Array // 0-255
  readInsertSizes: Float32Array // keep float (can be large/negative)
  readPairOrientations: Uint8Array // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
  readStrands: Int8Array // -1=reverse, 0=unknown, 1=forward
  readChainHasSupp?: Uint8Array // 1 if chain contains supplementary reads, 0 otherwise
  readIds: string[] // feature IDs for hit testing
  readNames: string[] // read names (QNAME) for tooltip display
  readNextRefs?: string[] // mate reference name for inter-chromosomal tooltip

  // Gap data (deletions/skips) - offsets from regionStart
  gapPositions: Uint32Array // [startOffset, endOffset] pairs
  gapYs: Uint16Array
  gapLengths: Uint16Array // length of each gap in bp
  gapTypes: Uint8Array // 0=deletion, 1=skip
  gapFrequencies: Uint8Array // 0-255 representing 0-100% frequency at start position

  // Mismatch data - offsets from regionStart
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array // ASCII character code (e.g. 65='A', 67='C', 71='G', 84='T')
  mismatchStrands: Int8Array // -1=reverse, 1=forward (for tooltip strand counts)
  mismatchFrequencies: Uint8Array // 0-255 representing 0-100% frequency at position

  // Interbase data - insertions, soft clips, and hard clips combined (offsets from regionStart)
  // These three feature types have identical structure, so combining reduces memory and transfer overhead
  interbasePositions: Uint32Array
  interbaseYs: Uint16Array
  interbaseLengths: Uint16Array
  interbaseTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip
  interbaseSequences: string[] // insertion sequences (empty string for clips or if unavailable)
  interbaseFrequencies: Uint8Array // 0-255 representing 0-100% frequency

  // Coverage data - positions computed from regionStart + coverageStartOffset + index * binSize
  // Coverage may extend beyond the requested region to cover full feature extents
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageBinSize: number
  coverageStartOffset: number // offset from regionStart where coverage begins (can be negative)

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

  // Tooltip data - detailed info for positions with SNPs or interbase events
  // Record from position offset to tooltip bin data
  tooltipData: Record<number, CoverageTooltipBin>

  // Sorted offsets of positions with significant SNPs (>5% of depth)
  // Used by hitTestCoverage to snap to SNP positions when zoomed out
  significantSnpOffsets: number[]

  // Tag color data - RGB per read (3 bytes each), only populated when colorBy.type === 'tag'
  readTagColors: Uint8Array
  numTagColors: number

  // Modification data (MM tag) - offsets from regionStart
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint8Array // packed RGBA (4 bytes per mod), alpha encodes probability
  numModifications: number

  // Modification coverage data - stacked colored bars in coverage area
  modCovPositions: Uint32Array // position offsets from regionStart
  modCovYOffsets: Float32Array // cumulative height below segment (normalized 0-1)
  modCovHeights: Float32Array // segment height (normalized 0-1)
  modCovColors: Uint8Array // packed RGBA, 4 bytes per segment
  numModCovSegments: number

  // Sashimi arc data (splice junctions from skip gaps)
  sashimiX1: Float32Array // bp offsets from regionStart (junction start)
  sashimiX2: Float32Array // bp offsets from regionStart (junction end)
  sashimiScores: Float32Array // per-arc line width = Math.log(count + 1)
  sashimiColorTypes: Uint8Array // 0=forward, 1=reverse
  sashimiCounts: Uint32Array // actual read counts per junction
  numSashimiArcs: number

  // Layout info
  maxY: number
  numReads: number
  numGaps: number
  numMismatches: number
  numInterbases: number
  numCoverageBins: number
  numSnpSegments: number
  numNoncovSegments: number
  numIndicators: number

  // All detected modification types in this region (detected during feature processing)
  detectedModifications: string[]

  // Simplex modification types detected in this region (detected during feature processing)
  simplexModifications: string[]

  // Connecting line data for chain modes (cloud/linkedRead)
  // One line per chain, drawn at chain Y between min(start) and max(end)
  connectingLinePositions?: Uint32Array // [startOffset, endOffset] pairs
  connectingLineYs?: Uint16Array // row for each line
  connectingLineColorTypes?: Uint8Array // 0=normal, 1=long insert, 2=short, 3=interchrom, 4=orientation
  numConnectingLines?: number

  // Flatbush R-tree over chain bounding boxes for spatial hit testing
  chainFlatbushData?: ArrayBuffer
  chainFirstReadIndices?: Uint32Array // maps Flatbush item index → first read index

  // Insert size statistics (mean ± 3 SD thresholds for coloring)
  insertSizeStats?: {
    upper: number // mean + 3*SD (too long → red)
    lower: number // mean - 3*SD (too short → pink)
  }
}
