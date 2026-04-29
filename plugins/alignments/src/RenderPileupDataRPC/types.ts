/**
 * Pileup Data RPC Types
 *
 * COORDINATE SYSTEM: all position arrays are absolute genomic uint32.
 * Every GPU shader consumes absolute uint32 positions and converts to
 * clip space via hp-math. See agent-docs/ARCHITECTURE.md "Coordinate
 * convention" and "BP precision" for details.
 */

import type { FilterBy } from '../shared/types'
import type { Region } from '@jbrowse/core/util'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderPileupDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  filterBy?: FilterBy
  colorBy?: {
    type: string
    tag?: string
    modifications?: { threshold?: number }
  }
  colorTagMap?: Record<string, string>
  // Tag name for tag-sort. Only the tag is sent to the worker (not the
  // full SortedBy), so changing sort position within a tag sort doesn't
  // invalidate the fetched data — main-thread layout re-runs instead.
  sortTag?: string
  showSoftClipping?: boolean
  statusCallback?: (status: string) => void
  stopToken?: StopToken
}

export type { CoverageTooltipBin } from '@jbrowse/alignments-core'

export interface ModTooltipEntry {
  count: number
  fwd: number
  rev: number
  probabilityTotal: number
  color: string
  name: string
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

export interface PileupDataResult {
  // Read data - positions are absolute genomic uint32
  readPositions: Uint32Array // [start, end] pairs
  readYs: Uint16Array // pileup row (0-65535 sufficient)
  readFlags: Uint16Array // BAM flags are 16-bit
  readMapqs: Uint8Array // 0-255
  readAvgBaseQualities: Uint8Array // 0-255 average per-base quality
  readInsertSizes: Float32Array // keep float (can be large/negative)
  readPairOrientations: Uint8Array // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
  readStrands: Int8Array // -1=reverse, 0=unknown, 1=forward
  readChainHasSupp?: Uint8Array // 1 if chain contains supplementary reads, 0 otherwise
  readIds: string[] // feature IDs for hit testing
  readNames: string[] // read names (QNAME) for tooltip display
  readNextRefs?: string[] // mate reference name for inter-chromosomal tooltip
  readChainIndices?: Uint32Array // chain index per read (only in chain mode)

  // Segment data - per-exon segments for GPU instancing (reads split at skip gaps)
  segmentPositions: Uint32Array // [start, end] absolute pairs per segment
  segmentReadIndices: Uint32Array // parent read index per segment
  segmentEdgeFlags: Uint8Array // bit 0=first segment, bit 1=last segment
  numSegments: number

  // Gap data (deletions/skips) - absolute genomic uint32
  gapPositions: Uint32Array // [start, end] pairs
  gapYs: Uint16Array
  gapLengths: Uint16Array // length of each gap in bp
  gapTypes: Uint8Array // 0=deletion, 1=skip
  gapReadIndices: Uint32Array // maps each gap to its parent read index
  gapFrequencies: Uint8Array // 0-255 representing 0-100% frequency at start position

  // Mismatch data - absolute genomic uint32
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array // ASCII character code (e.g. 65='A', 67='C', 71='G', 84='T')
  mismatchStrands: Int8Array // -1=reverse, 1=forward (for tooltip strand counts)
  mismatchReadIndices: Uint32Array // maps each mismatch to its parent read index
  mismatchFrequencies: Uint8Array // 0-255 representing 0-100% frequency at position

  // Soft clip base data - per-base rendering for showSoftClipping feature
  // Absolute genomic uint32 position for each base
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array // ASCII character code
  softclipBaseReadIndices: Uint32Array // maps each softclip base to its parent read index

  // Interbase data — insertions, soft clips, and hard clips in one buffer
  // stored sequentially as (insertions, softclips, hardclips). The three
  // counts below let consumers slice subranges without re-scanning types.
  interbasePositions: Uint32Array
  interbaseYs: Uint16Array
  interbaseLengths: Uint16Array
  interbaseTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip
  interbaseReadIndices: Uint32Array // maps each interbase to its parent read index
  interbaseSequences: string[] // insertion sequences (empty string for clips or if unavailable)
  numInsertions: number
  numSoftclips: number
  numHardclips: number
  interbaseFrequencies: Uint8Array // 0-255 representing 0-100% frequency

  // Coverage data - depths[i] covers [coverageStartPos + i, coverageStartPos + i + 1)
  // (bin size is always 1bp). Coverage may extend beyond the requested region.
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number // absolute genomic bp where coverage depths[0] begins
  // Pre-packed GPU buffer for PASS_COVERAGE (worker-built, zero-offset
  // positions). Main thread uploads directly without re-packing.
  coveragePackedBuffer: ArrayBuffer

  // SNP coverage data - absolute genomic coordinates
  snpPositions: Uint32Array
  snpYOffsets: Float32Array // normalized 0-1
  snpHeights: Float32Array // normalized 0-1
  snpColorTypes: Uint8Array // 1=A, 2=C, 3=G, 4=T
  // Pre-packed GPU buffer for PASS_SNP_COV (worker-built).
  snpPackedBuffer: ArrayBuffer

  // Noncov (interbase) coverage data - insertion/softclip/hardclip counts by position
  // Bars grow downward from top of coverage area
  noncovPositions: Uint32Array // absolute genomic coordinates
  noncovYOffsets: Float32Array // cumulative height below this segment (normalized 0-1)
  noncovHeights: Float32Array // height of this segment (normalized 0-1)
  noncovColorTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip
  noncovMaxCount: number // max total count at any position (for scaling)
  // Pre-packed GPU buffer for PASS_NONCOV (worker-built).
  noncovPackedBuffer: ArrayBuffer

  // Interbase indicator data - triangles at significant positions
  indicatorPositions: Uint32Array // absolute genomic coordinates
  indicatorColorTypes: Uint8Array // 1=insertion, 2=softclip, 3=hardclip (dominant type)
  // Pre-packed GPU buffer for PASS_INDICATOR (worker-built).
  indicatorPackedBuffer: ArrayBuffer

  // Modification tooltip data - only populated when colorBy is modifications/methylation
  modTooltipData?: Record<number, Record<string, ModTooltipEntry>>

  // Tag color per read, packed ABGR u32 (0 = no tag color). Only populated
  // when colorBy.type === 'tag'.
  readTagColors: Uint32Array

  // Modification data (MM tag) - absolute genomic uint32
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  // Packed ABGR u32 per modification; alpha byte encodes visual opacity (quadratic).
  modificationColors: Uint32Array
  // Raw probability 0-255; separate from alpha to avoid lossy quadratic roundtrip in tooltip.
  modificationProbabilities?: Uint8Array
  modificationReadIndices: Uint32Array // maps each modification to its parent read index
  modificationTypeIndices?: Uint8Array // maps each modification to index in detectedModifications

  // Modification coverage data - stacked colored bars in coverage area
  modCovPositions: Uint32Array // absolute genomic coordinates
  modCovYOffsets: Float32Array // cumulative height below segment (normalized 0-1)
  modCovHeights: Float32Array // segment height (normalized 0-1)
  modCovColors: Uint32Array // ABGR u32 per segment
  // Pre-packed GPU buffer for PASS_MOD_COV (worker-built).
  modCovPackedBuffer: ArrayBuffer

  // Sashimi arc data (splice junctions from skip gaps)
  sashimiX1: Uint32Array // absolute genomic bp (junction start)
  sashimiX2: Uint32Array // absolute genomic bp (junction end)
  sashimiScores: Float32Array // per-arc line width = Math.log(count + 1)
  sashimiColorTypes: Uint8Array // 0=forward, 1=reverse
  sashimiCounts: Uint32Array // actual read counts per junction

  // Layout info
  maxY: number

  // All detected modification types in this region (detected during feature processing)
  detectedModifications: string[]

  // Simplex modification types detected in this region (detected during feature processing)
  simplexModifications: string[]

  // Chain layout metadata — returned by RPC, consumed by main-thread layout.
  // Layout (Y positions) is computed on the main thread so that chains spanning
  // multiple displayedRegions can be assigned consistent rows across all regions.
  // One entry per chain, indexed by chain index (== readChainIndices values).
  chainAbsMinStarts?: Uint32Array // absolute genomic start of each chain
  chainAbsMaxEnds?: Uint32Array // absolute genomic end of each chain
  chainDistances?: Uint32Array // chain distance: templateLength or span
  chainNames?: string[] // read QNAME per chain (for cross-region dedup)
  chainHasMultiple?: Uint8Array // 1 if chain has ≥2 reads (draw connecting line)

  // Connecting line data for chain modes (cloud/linkedRead).
  // One line per chain, drawn at chain Y between min(start) and max(end).
  // Populated by main-thread layout after chain layout is computed.
  connectingLinePositions: Uint32Array // [start, end] absolute genomic uint32 pairs
  connectingLineYs: Uint16Array // row for each line

  // Linked-read straight-line connections for `linkedReadBezier` mode. Sibling
  // pass to `connectingLine*` because the bezier overlay's GPU pass differs:
  // per-endpoint Y (mates can sit on different rows when `sortedBy` is in
  // effect), and a per-line palette index instead of a hard-coded color.
  // Cross-region pairs are excluded — those keep being drawn as SVG straight
  // paths via PileupArcsOverlay (the GPU pass is one region per buffer).
  // Absolute genomic uint32 like all worker output (per ARCHITECTURE.md
  // coordinate convention).
  linkedReadLinePositions: Uint32Array // [bp1, bp2] pairs
  linkedReadLineYs: Uint16Array // [y1, y2] paired per line
  linkedReadLineColorTypes: Uint8Array // see LINKED_READ_COLOR_* constants
  numLinkedReadLines: number

  // Flatbush R-tree over chain bounding boxes for spatial hit testing.
  // Populated by main-thread layout after chain layout is computed.
  chainFlatbushData?: ArrayBuffer
  chainFirstReadIndices?: Uint32Array // maps Flatbush item index → first read index

  // Flatbush R-tree over modification points for spatial hit testing.
  // Built by cloneWithLayout after Y assignment; Flatbush item index == modification index.
  modFlatbush?: Flatbush

  // Insert size statistics (mean ± 3 SD thresholds for coloring)
  insertSizeStats?: {
    upper: number // mean + 3*SD (too long → red)
    lower: number // mean - 3*SD (too short → pink)
  }

  // Unique tag values discovered during feature iteration (for colorBy tag mode)
  newTagValues?: string[]

  // Per-read tag values for tag sort, parallel to readIds (only populated when sortedBy.type === 'tag').
  // Main thread uses these to compute sorted layout without needing a re-fetch.
  sortTagValues?: string[]

  // Per-read mate position (PNEXT) for main-thread arc computation
  readNextPositions?: Uint32Array

  // Per-read SA tag strings for main-thread arc computation
  readSuppAlignments?: string[]
}
