/**
 * Pileup Data RPC Types
 *
 * COORDINATE SYSTEM: all position arrays are absolute genomic uint32.
 * Every GPU shader consumes absolute uint32 positions and converts to
 * clip space via hp-math. See agent-docs/ARCHITECTURE.md "Coordinate
 * convention" and "BP precision" for details.
 */

import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ReadKeys } from '../shared/readIdentity.ts'
import type { ColorBy, FilterBy, GroupBy } from '../shared/types'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type Flatbush from '@jbrowse/core/util/flatbush'

// Args for the single RenderAlignmentData RPC. `linkedReads` selects the
// pileup (`'off'`) vs chain (`'normal'`) path inside the worker — the same flag
// the client already tracks, so no separate `mode` is needed.
// `sortTag`/`showSoftClipping` are pileup-only — the chain path forces them off
// below, and the display projects them the same way so the `rpcProps` cache key
// doesn't refetch for a value this worker will discard. `drawSingletons`/
// `drawProperPairs`/`showOnlySplitAlignments` (grouped-by-read-name chain
// filters) apply in both modes.
export interface RenderAlignmentDataArgs {
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: Region[]
  filterBy?: FilterBy
  colorBy?: ColorBy
  // Tag name for tag-sort. Only the tag is sent to the worker (not the
  // full SortedBy), so changing sort position within a tag sort doesn't
  // invalidate the fetched data — main-thread layout re-runs instead.
  sortTag?: string
  showSoftClipping?: boolean
  // Tier-1 refetch (in rpcProps): when the coverage band is off — the
  // LGVSyntenyDisplay default — the worker skips every band computation and
  // returns an empty coverage depth array, avoiding the ~regionWidth×8-byte
  // per-bp GPU buffer that overflows the device limit at whole-chromosome scale.
  // The pileup's low-frequency mismatch/indel fade is unaffected (frequencies
  // are computed from the full depth sweep regardless). Defaults true.
  showCoverage?: boolean
  // In-track stacked grouping. When set, the worker partitions the single fetch
  // into N ordered groups and returns one PileupDataResult per group. Honored in
  // chain mode too, but only for the chain-consistent dimensions — `groupByForMode`
  // degrades a per-read one to ungrouped rather than splitting a chain across
  // sections, and `partitionChains` assigns each chain as a unit. Tier-1 refetch
  // setting (in rpcProps): changing it re-partitions, so the worker must re-run.
  groupBy?: GroupBy
  // Which detail tier a tiered adapter should serve. Set only by the synteny
  // displays, whose PIF adapters carry a coarse no-CIGAR tier for zoomed-out
  // views; read adapters have no tiers and ignore it. A tier-1 refetch setting
  // (in rpcProps): switching tiers means different rows, so the worker must
  // re-run. Resolved to an explicit 'fine'/'coarse' rather than passed as a raw
  // bpPerPx so the rpcProps cache key changes only when the tier actually flips,
  // not on every zoom step.
  lodMode?: BaseOptions['lodMode']
  linkedReads?: 'off' | 'normal'
  drawSingletons?: boolean
  drawProperPairs?: boolean
  showOnlySplitAlignments?: boolean
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

// The worker→main transport payload for one group's reads. A wide DTO: the
// per-feature draw/pack functions depend only on their narrow `features/X/types.ts`
// contract (which this structurally satisfies), not on the whole struct. Fields
// group into row-instanced features (carry `*Ys`, packed main-thread post-layout)
// and position-aggregate features (no `*Ys`, pre-packed in the worker as a
// `*PackedBuffer`) — see plugins/alignments/src/RenderAlignmentDataRPC/CLAUDE.md §"Row-instanced vs position-aggregate".
export interface PileupDataResult {
  // Read data - positions are absolute genomic uint32
  // [start, end] pairs — the read's true alignment span, never clipped to the
  // region. Clipping to the region is the drawn geometry's job (buildSegments).
  readPositions: Uint32Array
  readYs: Uint16Array // pileup row (0-65535 sufficient)
  readFlags: Uint16Array // BAM flags are 16-bit
  readMapqs: Uint8Array // 0-255
  // |TLEN|, never signed — buildBaseFeatureData abs's it, and 0 means unset
  // (unpaired). Float because TLEN outgrows an int16 and the GPU reads it as
  // f32. Consumers can classify it directly; no re-abs.
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
  // RC_* color category per read (read.slang). Empty from the worker; the
  // main thread bakes it in `overlayReadColorCategories` — see readTagColors
  // for why classification stays off the worker boundary.
  readColorCategories: Uint8Array
  readStrands: Int8Array // -1=reverse, 0=unknown, 1=forward
  readChainHasSupp?: Uint8Array // 0=no supp, 1=supp+primary fwd, 2=supp+primary rev, 3=paired split inversion, 4=paired split deletion
  readInterchrom: Uint8Array // 1 = mate on a different chromosome (else 0)
  // Per-read identity for hit testing, dedupe and layout tiebreaks — numeric
  // for BAM/CRAM, with `readIdPrefix` rebuilding the `feature.id()` string at
  // the few places one escapes. shared/readIdentity.ts holds the invariant.
  readKeys: ReadKeys
  readIdPrefix: string | undefined
  // Every read's QNAME as one string plus offsets into it — `readNameAt` slices
  // one back out. See shared/readNameBlock.ts for why it is a block and not an
  // array, and what that costs the two consumers that want all of them.
  readNameBlock: string
  readNameOffsets: Uint32Array
  // Mate reference per read as a slot into `nextRefNames` — `nextRefAt` reads
  // one. A string per read held ONE distinct value on the deepest fixture; see
  // shared/readNextRefs.ts.
  readNextRefIds: Int32Array
  nextRefNames: string[]
  readChainIndices?: Uint32Array // chain index per read (only in chain mode)

  // Segment data - per-exon segments for GPU instancing (reads split at skip gaps)
  segmentPositions: Uint32Array // [start, end] absolute pairs per segment
  segmentReadIndices: Uint32Array // parent read index per segment
  segmentEdgeFlags: Uint8Array // bit 0=first segment, bit 1=last segment
  numSegments: number

  // Gap data (deletions/skips) - absolute genomic uint32
  gapPositions: Uint32Array // [start, end] pairs
  gapYs: Uint16Array
  gapTypes: Uint8Array // GAP_DELETION / GAP_SKIP (gap.slang)
  gapReadIndices: Uint32Array // maps each gap to its parent read index
  gapFrequencies: Uint8Array // 0-255 representing 0-100% frequency at start position

  // Mismatch data - absolute genomic uint32
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array // ASCII character code (e.g. 65='A', 67='C', 71='G', 84='T')
  mismatchStrands: Int8Array // -1=reverse, 1=forward (for tooltip strand counts)
  mismatchReadIndices: Uint32Array // maps each mismatch to its parent read index
  mismatchFrequencies: Uint8Array // 0-255 representing 0-100% frequency at position
  mismatchQuals: Uint8Array // per-base Phred quality; 0 = no quality (fully opaque)

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
  interbaseLengths: Uint32Array
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
  // Per-strand depths parallel to coverageDepths (forward/reverse read strand).
  // Back the coverage tooltip's strand breakdown; empty when no features.
  coverageFwdDepths: Float32Array
  coverageRevDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number // absolute genomic bp where coverage depths[0] begins
  // Coarse per-bin partial stats (downsampleStatsBins) covering the same span as
  // coverageDepths. Empty with binSize 1 below the cap; populated at whole-
  // chromosome scale so the main-thread autoscale reduce is O(bins) not O(bp)
  // (kills the coverage-band pan/zoom scan). coverageDepths above stays per-bp
  // for hit-test / tooltip. bin b spans [coverageStartPos + b*binSize, +binSize).
  coverageStatsBinSize: number
  coverageStatsMins: Float32Array
  coverageStatsMaxs: Float32Array
  coverageStatsSums: Float64Array
  coverageStatsSumSqs: Float64Array
  // Pre-packed GPU buffer for COVERAGE_PASS (worker-built). Its depth bars are
  // downsampled to a fixed bin cap so its record count (coverageGpuBinCount)
  // tracks screen pixels, not region width — otherwise it overflows the GPU
  // device limit at whole-chromosome scale. coverageBinSize is each bar's width
  // in bp (1 = per-bp), fed to the shader's binSize uniform. coverageDepths
  // above stays per-bp for hit-test / stats. Main thread uploads directly.
  coverageBinSize: number
  coverageGpuBinCount: number
  coveragePackedBuffer: ArrayBuffer

  // The coverage band's four segment layers, each as its packed instance
  // buffer and nothing else. Worker-built, uploaded verbatim by the GPU
  // renderer, and read in place by the Canvas2D draw, the SVG export and the
  // interbase hit test — so a mark is hit-tested against the record that was
  // painted rather than a second copy of it. `readInterbaseSegments` /
  // `readIndicators` (alignments-core) are the decode side; the field offsets
  // are Slang codegen, so nothing here restates a record shape.

  // SNP_COVERAGE_PASS. yOffset/segHeight are fractions of THIS position's
  // coverage bar; relDepth = totalDepthAtPos / regionMaxDepth scales it at draw
  // time.
  snpPackedBuffer: ArrayBuffer

  // INTERBASE_PASS: the interbase histogram's stacked insertion/softclip/
  // hardclip bars, hanging from the top of the coverage area, in ascending
  // position order with one position's segments consecutive.
  interbasePackedBuffer: ArrayBuffer
  // The denominator those stack fractions were baked against: the region's PEAK
  // READ DEPTH, floored at 1, or 0 when the region has no interbase events at
  // all. Not a count of interbase events despite the name — a bar of N events
  // is `N / interbaseMaxCount` in the buffer and `interbaseBarHeightPx` puts it
  // back on the display's autoscaled depth axis, which is what makes the
  // interbase bars readable against the coverage bars beside them.
  interbaseMaxCount: number

  // INDICATOR_PASS: triangles at the positions where interbase events are a
  // significant fraction of local depth.
  indicatorPackedBuffer: ArrayBuffer

  // Per-position modification aggregates for the coverage tooltip, as flat
  // transferable arrays (shared/modTooltipIndex.ts, which owns the layout and
  // says why it is not a Record). Read one position at a time by
  // `modTooltipEntriesAt`; zero-length when colorBy is not
  // modifications/methylation.
  modTooltipPositions: Uint32Array
  modTooltipOffsets: Uint32Array
  modTooltipCounts: Uint32Array
  modTooltipFwd: Uint32Array
  modTooltipRev: Uint32Array
  modTooltipProbTotals: Float64Array
  modTooltipColors: Uint32Array
  modTooltipLabelIds: Uint16Array
  modTooltipLabels: string[]

  // Tag color per read, packed ABGR u32 (0 = no tag color). The worker leaves
  // this empty — it is baked on the main thread (overlayReadTagColors) from
  // `readTagValues` + `colorTagMap` so colorTagMap never crosses the worker
  // boundary. Only populated (main-thread) when colorBy.type === 'tag'.
  readTagColors: Uint32Array

  // Raw per-read tag value strings (parallel to readKeys), populated by the
  // worker only in tag color mode. The main thread bakes these into
  // readTagColors via colorTagMap.
  readTagValues?: string[]

  // Modification data (MM tag) - absolute genomic uint32
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  // Packed ABGR u32 per modification; alpha byte encodes visual opacity (quadratic).
  modificationColors: Uint32Array
  // Raw probability 0-255; separate from alpha to avoid lossy quadratic roundtrip in tooltip.
  modificationProbabilities?: Uint8Array
  modificationReadIndices: Uint32Array // maps each modification to its parent read index
  modificationTypeIndices?: Uint8Array // index into modificationTypes
  modificationTypes?: string[]
  // 1 = the no-mod bucket (this call says the base is UNmodified, and its
  // probability is the confidence of that). modType stays the canonical mod code
  // in both buckets, so this is the only thing that tells them apart.
  modificationNoMod?: Uint8Array

  // Per-base quality overlay data — only populated when colorBy.type === 'perBaseQuality'.
  // One entry per ref-aligned base inside the region; main thread paints
  // overlay rects on top of the GPU-rendered read body.
  perBaseQualPositions: Uint32Array // absolute genomic uint32
  perBaseQualYs: Uint16Array // pileup row, filled by main-thread layout
  perBaseQualScores: Uint8Array // raw 0-255 quality score
  perBaseQualReadIndices: Uint32Array // maps to parent read index

  // Per-base lettering overlay data — only populated when
  // colorBy.type === 'perBaseLetter'. One entry per ref-aligned base; every
  // base is drawn in its nucleotide color via the shared mismatch pass.
  perBaseLetterPositions: Uint32Array // absolute genomic uint32
  perBaseLetterYs: Uint16Array // pileup row, filled by main-thread layout
  perBaseLetterBases: Uint8Array // uppercase ASCII base code
  perBaseLetterReadIndices: Uint32Array // maps to parent read index

  // MOD_COVERAGE_PASS: the modification band's stacked colored bars. Same
  // per-position fraction contract as snpPackedBuffer above, with an ABGR u32
  // per segment in place of a color type.
  modCovPackedBuffer: ArrayBuffer

  // Sashimi arc data (splice junctions from skip gaps). One entry per junction,
  // parallel across all four arrays.
  sashimiX1: Uint32Array // absolute genomic bp (junction start)
  sashimiX2: Uint32Array // absolute genomic bp (junction end)
  sashimiStrands: Int8Array // dominant strand: +1 forward, -1 reverse, 0 unknown
  sashimiCounts: Uint32Array // supporting reads per junction, all strands

  // Layout info
  maxY: number

  // Set by main-thread layout when the pileup stack was clipped at the
  // configured maxHeight (reads beyond the cap collapse to the bottom row).
  truncated?: boolean

  // All detected modification types in this region (detected during feature processing)
  detectedModifications: string[]

  // Chain layout metadata — returned by RPC, consumed by main-thread layout.
  // Layout (Y positions) is computed on the main thread so that chains spanning
  // multiple displayedRegions can be assigned consistent rows across all regions.
  // One entry per chain, indexed by chain index (== readChainIndices values).
  chainAbsMinStarts?: Uint32Array // absolute genomic start of each chain
  chainAbsMaxEnds?: Uint32Array // absolute genomic end of each chain
  chainDistances?: Uint32Array // chain distance: templateLength or span
  chainNames?: string[] // chain identity key: QNAME, or a unique synthetic key
  // for secondary alignments (see chainGroupingKey); for cross-region dedup
  chainHasMultiple?: Uint8Array // 1 if chain has ≥2 reads (draw connecting line)

  // Connecting line data for chain modes (cloud/linkedRead).
  // One line per chain, drawn at chain Y between min(start) and max(end).
  // Populated by main-thread layout after chain layout is computed.
  connectingLinePositions: Uint32Array // [start, end] absolute genomic uint32 pairs
  connectingLineYs: Uint16Array // row for each line

  // Chain-mode read overlaps: genomic intervals where two reads in the same
  // chain (and thus the same row) overlap. Drawn as a mild semi-transparent
  // dark tint so the overlapped span is visible despite the upper read painting
  // over the lower one. Absolute genomic uint32 like all worker output; populated by
  // main-thread layout (overlaps are per-region, so no cross-region pass).
  overlapPositions: Uint32Array // [start, end] absolute genomic uint32 pairs
  overlapYs: Uint16Array // shared chain row for each overlap

  // Linked-read straight-line connections for `linkedReadBezier` mode. Sibling
  // pass to `connectingLine*` because the bezier overlay's GPU pass differs:
  // per-endpoint Y (mates can sit on different rows when `sortedBy` is in
  // effect), and a per-line palette index instead of a hard-coded color.
  // Cross-region pairs are excluded — those keep being drawn as SVG straight
  // paths via PileupBezierOverlay (the GPU pass is one region per buffer).
  // Absolute genomic uint32 like all worker output (per ARCHITECTURE.md
  // coordinate convention).
  linkedReadLinePositions: Uint32Array // [bp1, bp2] pairs
  linkedReadLineYs: Uint16Array // [y1, y2] paired per line
  linkedReadLineColorTypes: Uint8Array // see LINKED_READ_COLOR_* constants
  numLinkedReadLines: number

  // Flatbush R-tree over chain bounding boxes for spatial hit testing.
  // Populated by main-thread layout after chain layout is computed.
  // Stored as the live Flatbush instance (not an ArrayBuffer) — chain
  // layout runs on the main thread, so there is no transfer boundary
  // requiring serialization.
  chainFlatbush?: Flatbush
  chainFirstReadIndices?: Uint32Array // maps Flatbush item index → first read index

  // Flatbush R-tree over modification points for spatial hit testing.
  // Built by cloneWithLayout after Y assignment; Flatbush item index == modification index.
  modFlatbush?: Flatbush

  // The short/normal/long |TLEN| thresholds for insert-size coloring: robust
  // median ± 3·1.4826·MAD over the fetch's primary proper pairs, pooled across
  // every group (see computePairedInsertSizeStats / getInsertSizeStats). Absent
  // when the fetch has no usable paired sample, which classifyInsertSize reads
  // as "everything normal".
  insertSizeStats?: InsertSizeBand

  // Unique tag values discovered during feature iteration (for colorBy tag mode)
  newTagValues?: string[]

  // Per-read tag values for tag sort, parallel to readKeys (only populated when sortedBy.type === 'tag').
  // Main thread uses these to compute sorted layout without needing a re-fetch.
  sortTagValues?: string[]

  // Per-read mate position (PNEXT) for main-thread arc computation
  readNextPositions?: Uint32Array

  // Per-read SA tag strings, for the main thread's two chain readers — the arc
  // computation and `derivativePathCandidates`. Absent when no read in the
  // group carried one, which is the deep short-read case and every synteny one;
  // see `extractFeatureArrays` for why that is the whole of the optimization
  // here and why the walk itself is unconditional.
  readSuppAlignments?: string[]

  // Per-read soft/hard-clip length at the 5' start of the read, in read
  // coordinates (getClip, strand-aware). Read-order sort key so split segments
  // chain in true read order rather than genomic order (see readGroupConnections).
  readClipAtStart?: Uint32Array
}

// The chain-only fields are emitted as a group by `buildChainResultFields`
// (chain mode) and entirely absent in pileup mode — they always co-vary. A
// single guard narrows the whole set, so consumers never have to re-assert
// that the siblings of the field they checked are also present.
export type ChainPileupData = PileupDataResult &
  Required<
    Pick<
      PileupDataResult,
      | 'readChainIndices'
      | 'readChainHasSupp'
      | 'chainAbsMinStarts'
      | 'chainAbsMaxEnds'
      | 'chainDistances'
      | 'chainNames'
      | 'chainHasMultiple'
      | 'chainFirstReadIndices'
    >
  >

export function isChainData(data: PileupDataResult): data is ChainPileupData {
  return data.readChainIndices !== undefined
}

// One stacked section: a group key + its display label + the per-group pileup
// data. Ungrouped fetches return a single group with `key: ''`, giving one
// uniform code path for grouped and ungrouped reads.
export interface AlignmentGroup {
  key: string
  label: string
  data: PileupDataResult
}

// The RenderAlignmentData RPC return. Always at least one group.
export interface GroupedAlignmentsResult {
  groups: AlignmentGroup[]
}
