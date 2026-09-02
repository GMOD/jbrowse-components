import {
  countSnpsAtPosition,
  forEachAtPosition,
  formatInsertionLabel,
  interbaseDepthAt,
  lowerBound,
  positionOrder,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { toLocale } from '@jbrowse/core/util'

import {
  ARC_SHAPE_FLAT,
  isUnplacedArcShape,
} from '../../features/arcs/shapes.ts'
import { spliceMotifLabel } from '../../features/sashimi/motif.ts'
import { GAP_DELETION } from '../../shaders/slang/gap.consts.generated.ts'
import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import { formatLocationRange } from '../../shared/locStrings.ts'
import { modTooltipEntriesAt } from '../../shared/modTooltipIndex.ts'
import { readNameAt } from '../../shared/readNameBlock.ts'
import { nextRefAt } from '../../shared/readNextRefs.ts'
import { getCigarTypeLabel, interbaseTypeName } from '../../shared/types.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
import { MAPQ_UNAVAILABLE, getOrCreate } from '../../shared/util.ts'
import { READ_COLOR_CATEGORY_BY_INDEX } from '../colorUtils.ts'
import { accumulateLength, toLengthStats } from './lengthStats.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type {
  ArcHitResult,
  ArcLineHitResult,
} from '../../features/arcs/hitTest.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ReadColorCategory } from '../colorUtils.ts'
import type { LengthAccumulator } from './lengthStats.ts'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'

// The interbase slice of a coverage position — what the interbase histogram bars
// and indicator triangles report. `depth` is carried for the detail widget's
// context row; the SNP/deletion tallies the shared CoverageTooltipBin also holds
// are neither rendered nor consulted here, so this path never computes them.
export interface InterbaseBin {
  position: number
  depth: number
  interbase: CoverageTooltipBin['interbase']
  interbaseDepth: number
}

// The converse slice: depth, SNP bases, deletions, modifications. Interbase
// events are deliberately absent — they're reached by hovering the histogram
// bars directly (InterbaseBin above), so mixing them into the depth table would
// double-report them.
export type CoverageBin = Omit<
  CoverageTooltipBin,
  'interbase' | 'interbaseDepth'
>

export interface IndicatorTooltipPayload {
  type: 'indicator'
  bin: InterbaseBin
  refName?: string
}

export interface CoverageTooltipPayload {
  type: 'coverage'
  bin: CoverageBin
  refName?: string
}

export interface ModificationTooltipPayload extends ModificationHitResult {
  type: 'modification'
  refName?: string
  snpBase?: string
}

export interface SashimiTooltipPayload {
  type: 'sashimi'
  start: number
  end: number
  score: number
  strand: string
  refName: string
  // 'GT-AG' / 'GC-AG' / 'AT-AC' / 'non-canonical'; absent when never looked up
  motif?: string
}

export interface ArcTooltipPayload {
  type: 'arc'
  refName: string
  // The two endpoints in absolute genomic bp, ordered left-to-right — UNLESS
  // `endRefName` is set, where they are `refName`'s end and `endRefName`'s end
  // in that order and ordering them would be meaningless.
  start: number
  end: number
  // The far end's chromosome, present only when it differs from `refName`. An
  // interchromosomal arc is the one mark whose two feet are not on one number
  // line, so it is rendered as two positions rather than as a range with a
  // distance: `chr22:23,290,313-130,853,964` names one chromosome and a
  // coordinate from another, and a bp distance across a translocation is not a
  // quantity. As a tick this fact was readable from the mark itself; as an arc
  // the colour is the only channel carrying it, so the hover has to say it.
  endRefName?: string
  // Reads behind this arc. One arc is one junction since `resolveArcs`, so this
  // is the number the stroke width encodes — and the reason the hover is worth
  // having: the picture ranks junctions, and this says by how much.
  support: number
  // The color bucket's own wording, so the tooltip names what the color already
  // says. Undefined for a bucket with no single swatch.
  category: string | undefined
  // |tlen| for a read-cloud flat line, which is the quantity its Y encodes.
  // Absent for a curved arc, whose Y is derived from the endpoints and would
  // just restate the span.
  insertSize?: number
  // How far away the partner is, for a read-cloud mark whose partner is outside
  // every loaded region. Present INSTEAD of the location range, which such a
  // mark cannot answer: its two feet are collapsed onto the one end the view can
  // place, so `start` and `end` are that single coordinate and a range between
  // them is zero wide. See `ARC_SHAPE_FLAT_UNPLACED`.
  unplacedPartnerBp?: number
}

// An interchromosomal connector tick. Its own payload rather than an
// `ArcTooltipPayload` with optional halves: a tick has ONE endpoint, no span, no
// insert size and no colour bucket (every tick is ARC_COLOR_INTERCHROM), and
// what it does have — the chromosomes on the far side — no arc has.
export interface ArcLineTooltipPayload {
  type: 'arcLine'
  refName: string
  // The breakpoint itself, in absolute genomic bp.
  position: number
  // The chromosome(s) the reads through this breakpoint have their mates on,
  // sorted. Never empty. More than one is a genuinely complex rearrangement
  // rather than a formatting edge case, so the tooltip lists them all.
  partnerRefNames: string[]
  // Reads behind the tick, which is what its stroke width encodes.
  support: number
  // Whether the far end of every connection under this tick is somewhere the
  // view cannot show. True in arc mode and only there, which is a property of
  // the feed rather than a hedge: `resolveArcs` sends a connection with both
  // feet in displayed regions to the cross-region ARC, so a tick that survives
  // `lineTouchesRegion` can only have been pushed for a partner that resolved
  // to no region. Read cloud is the exception — it ticks every
  // interchromosomal connection, displayed partner or not, because the cloud's
  // Y axis is insert size and a translocation has none.
  //
  // The hover needs it because naming the mate chromosome is not enough when
  // that chromosome is ON SCREEN with arcs into it: the reader looks across,
  // finds the partner window, and has no way to learn that these particular
  // reads land outside it.
  partnerOffView: boolean
}

// "Supported by 1 read" / "Supported by 12 reads". Singular at 1 so a lone
// connection does not read as a suspiciously weak junction.
export function supportLabel(support: number) {
  return support === 1
    ? 'Supported by 1 read'
    : `Supported by ${toLocale(support)} reads`
}

// HTML/plain strings come from formatReadTooltip / formatCigarTooltip;
// structured payloads come from the other formatters. The consumer dispatches on
// typeof + .type.
export type TooltipPayload =
  | string
  | IndicatorTooltipPayload
  | CoverageTooltipPayload
  | ModificationTooltipPayload
  | SashimiTooltipPayload
  | ArcTooltipPayload
  | ArcLineTooltipPayload

export function pct(n: number, total: number) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

// "12/40 (30.0%)" — the count-against-total reading shared by the coverage and
// interbase tooltips and their detail widgets.
//
// A zero total reports the bare count: `interbaseDepthAt` is 0 for an event at
// the edge of the coverage array (a clip at the region boundary), and a share of
// nothing isn't a number — that case used to render "3/0 (300.0%)".
export function countOfTotal(count: number, total: number) {
  return total > 0 ? `${count}/${total} (${pct(count, total)})` : `${count}`
}

// "5bp" when the range collapses, "5-8bp" otherwise. Shared by the interbase,
// coverage, and deletion tooltip rows so they render length spans identically.
export function formatLenRange(minLen: number, maxLen: number) {
  return minLen === maxLen ? `${minLen}bp` : `${minLen}-${maxLen}bp`
}

const PAIR_ORIENTATION_NAMES = ['', 'LR', 'RL', 'RR', 'LL'] as const

// Only the abnormal orientations get a line of their own — LR (1) is the normal
// pair and 0 is "unknown", neither of which is worth reporting. Indexed by the
// same pairOrientationToNum encoding as PAIR_ORIENTATION_NAMES, so a lookup miss
// IS the "nothing to say" answer and no separate `> 1` guard is needed.
const ABNORMAL_ORIENTATION_DESCRIPTIONS: Record<number, string> = {
  2: 'Outward facing pair',
  3: 'Both mates reverse strand',
  4: 'Both mates forward strand',
}

// Human-readable pair anomalies for the tooltip. An unmapped mate or an
// inter-chromosomal mate makes insert size / orientation meaningless (matching
// the dedicated color buckets), so those pre-empt everything. Otherwise a
// same-chromosome pair can be BOTH abnormally oriented AND have an anomalous
// insert size, so both lines are reported — unlike the single fill color, which
// must pick one. Insert size flows through the shared classifyInsertSize (its
// unset-TLEN guard included) so it can't drift from the coloring thresholds.
//
// `interchrom` is the worker's per-read flag (buildReadInterchrom), NOT a
// refName comparison done here. RNEXT carries the BAM header's own naming
// (`chr1`) while a main-thread refName is assembly-canonical (`1`), so comparing
// them here reported every paired read on an aliased BAM as inter-chromosomal —
// and, being pre-emptive, swallowed its real orientation/insert-size lines. The
// worker does the same comparison with both names in file space, which is where
// the read fill gets it right, so reuse that verdict rather than re-deriving it.
function getPairTypeDescriptions({
  flags,
  pairOrientation,
  insertSize,
  interchrom,
  insertSizeStats,
  nextRef,
}: {
  flags: number
  pairOrientation: number
  insertSize: number
  interchrom: number
  insertSizeStats?: InsertSizeBand
  nextRef: string
}): string[] {
  if (flags & SAM_FLAG_MATE_UNMAPPED) {
    return ['Unmapped mate']
  }
  if (interchrom === 1) {
    return [
      nextRef
        ? `Inter-chromosomal (mate on ${nextRef})`
        : 'Inter-chromosomal mate',
    ]
  }
  const out: string[] = []
  const orient = ABNORMAL_ORIENTATION_DESCRIPTIONS[pairOrientation]
  if (orient) {
    out.push(orient)
  }
  const insertClass = classifyInsertSize(insertSize, insertSizeStats)
  if (insertClass === 'long') {
    out.push('Long insert size')
  } else if (insertClass === 'short') {
    out.push('Short insert size')
  }
  return out
}

// The span the chain covers in THIS region, from the chain arrays rather than
// from the read at `idx`. `hitTestChain` answers a hover with the chain's FIRST
// read, so a cursor on the connecting line between two mates was told mate 1's
// coordinates under a heading naming the whole template — and the connecting
// line is a thing users hover on purpose now that chain mode draws one across
// displayed regions too. Falls back to the read's own span for a hover that
// resolved no chain (an ordinary read, or data with no chain metadata).
function chainSpan(rpcData: PileupDataResult, idx: number) {
  const chainIdx = rpcData.readChainIndices?.[idx]
  const start =
    chainIdx === undefined ? undefined : rpcData.chainAbsMinStarts?.[chainIdx]
  const end =
    chainIdx === undefined ? undefined : rpcData.chainAbsMaxEnds?.[chainIdx]
  return start !== undefined && end !== undefined
    ? { start, end }
    : {
        start: rpcData.readPositions[idx * 2] ?? 0,
        end: rpcData.readPositions[idx * 2 + 1] ?? 0,
      }
}

/**
 * The pileup hover, in every mode, and the one place that names a read's COLOR.
 *
 * One formatter for both modes: `chainSpan` is the chain's extent where there is
 * a chain and the read's own where there isn't, every other row reads a field
 * the worker fills either way, and a row with nothing to say appends nothing.
 *
 * Chain mode is the only mode where the fill cannot be derived from the read's
 * own record: `consensusChainStrandFrames` settles which way "same strand"
 * points from the OTHER chains on screen, so a reverse-mapped segment can
 * legitimately be painted "same strand" and a reader looking at the record has
 * no way to get there. `(-)` and "Split segment (same strand)" both being true
 * is the confusing case, and naming the bucket is what connects the color to the
 * legend row that explains it.
 *
 * `categoryLabel` arrives already carrying the scheme's rewording (the model's
 * `readCategoryLabel`), so this line and the swatch cannot disagree. Undefined
 * for the buckets with no single name — the mapq/tag/modification ramps, and an
 * ordinary unbucketed read — which append nothing rather than a blank row.
 */
export function formatReadTooltip(
  rpcData: PileupDataResult,
  idx: number,
  refName: string,
  categoryLabel?: (c: ReadColorCategory) => string | undefined,
) {
  const name = readNameAt(rpcData, idx)
  const { start, end } = chainSpan(rpcData, idx)
  const flags = rpcData.readFlags[idx] ?? 0
  const insertSize = rpcData.readInsertSizes[idx] ?? 0
  const pairOrientation = rpcData.readPairOrientations[idx] ?? 0
  const mapq = rpcData.readMapqs[idx]

  const lines = [
    `<b>${name}</b>`,
    `${formatLocationRange(refName, start, end)} (${rpcData.readStrands[idx] === -1 ? '-' : '+'})`,
  ]

  if (mapq !== undefined) {
    // 255 is the SAM spec's "not available", which the color scheme, the legend
    // and the group-by dimension all name rather than plot — so the row says it
    // too instead of reporting the sentinel as a very good alignment.
    lines.push(mapq === MAPQ_UNAVAILABLE ? 'MAPQ unavailable' : `MAPQ: ${mapq}`)
  }

  // readInsertSizes is |TLEN| already (buildBaseFeatureData abs's it).
  if (insertSize !== 0) {
    lines.push(`Template length: ${toLocale(insertSize)}`)
  }

  const orientName = PAIR_ORIENTATION_NAMES[pairOrientation]
  if (orientName) {
    lines.push(`Pair orientation: ${orientName}`)
  }

  lines.push(
    ...getPairTypeDescriptions({
      flags,
      pairOrientation,
      insertSize,
      interchrom: rpcData.readInterchrom[idx] ?? 0,
      insertSizeStats: rpcData.insertSizeStats,
      nextRef: nextRefAt(rpcData, idx),
    }),
  )

  if (flags & SAM_FLAG_SUPPLEMENTARY) {
    lines.push('Supplementary alignment')
  }

  // `readColorCategories` is EMPTY until the main thread bakes it — the worker
  // ships it that way — so this is a real absence on a hover that beats the
  // bake, not a defensive `?.`. Both halves resolve to "say nothing" rather than
  // to a `Color: undefined` row.
  const bucket =
    READ_COLOR_CATEGORY_BY_INDEX[rpcData.readColorCategories[idx] ?? -1]
  const category = bucket && categoryLabel?.(bucket)
  if (category) {
    lines.push(`Color: ${category}`)
  }

  return lines.join('<br>')
}

export function formatCigarTooltip(cigarHit: CigarHitResult) {
  const pos = toLocale(cigarHit.position + 1)
  switch (cigarHit.type) {
    case 'mismatch': {
      // Absent = the read reported no base quality; omit the parenthetical
      // rather than invent one. Q0 is a score and prints, which is the point of
      // resolving the sentinel in `hitTestMismatch` rather than here: the worst
      // possible call is worth showing, and truthiness could not tell the two
      // apart.
      const qual = cigarHit.qual === undefined ? '' : ` (Q${cigarHit.qual})`
      return `SNP: ${cigarHit.base} at ${pos}${qual}`
    }
    case 'insertion':
      return `${formatInsertionLabel(cigarHit.length, cigarHit.sequence)} at ${pos}`
    // deletion / skip / softclip / hardclip all read "<label> (Nbp) at pos", and
    // the label comes from the shared vocabulary so the hover, the widget title,
    // and the context menu can't spell the same op three ways.
    default:
      return `${getCigarTypeLabel(cigarHit.type)} (${cigarHit.length}bp) at ${pos}`
  }
}

// The most-seen key of a tally, or undefined for an empty one. Pulled out so
// "the commonest inserted sequence" reads as that rather than as a max-scan.
function mostCommon(counts: Map<string, number>) {
  let top: { seq: string; count: number } | undefined
  for (const [seq, count] of counts) {
    if (top === undefined || count > top.count) {
      top = { seq, count }
    }
  }
  return top
}

// Per-type (insertion / softclip / hardclip) length stats for the interbase
// events at exactly `position`, plus the commonest sequence of each type.
function collectInterbaseStats(position: number, data: PileupDataResult) {
  const {
    interbasePositions,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
  } = data
  const lengths = new Map<string, LengthAccumulator>()
  const seqCounts = new Map<string, Map<string, number>>()
  // One binary search per interbase block — a hover asks about one position out
  // of every insertion and clip in the block, and it asks on every mousemove.
  // The array is sorted WITHIN each of its (insertions, softclips, hardclips)
  // runs rather than across them, because those boundaries are what three GPU
  // passes slice on. `interbaseRangeEnds` is that layout's single declaration,
  // the same one the renderers take their `subarray` bounds from.
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  forEachAtPosition(interbasePositions, [insEnd, scEnd, hcEnd], position, i => {
    const typeName = interbaseTypeName(interbaseTypes[i]!)
    lengths.set(
      typeName,
      accumulateLength(lengths.get(typeName), interbaseLengths[i]!),
    )
    const seq = interbaseSequences[i]
    if (seq) {
      const typeSeqs = getOrCreate(
        seqCounts,
        typeName,
        () => new Map<string, number>(),
      )
      typeSeqs.set(seq, (typeSeqs.get(seq) ?? 0) + 1)
    }
  })
  const out: CoverageTooltipBin['interbase'] = {}
  for (const [typeName, acc] of lengths) {
    const typeSeqs = seqCounts.get(typeName)
    const top = typeSeqs && mostCommon(typeSeqs)
    out[typeName] = {
      ...toLengthStats(acc),
      topSeq: top?.seq,
      topSeqCount: top?.count,
    }
  }
  return out
}

/**
 * Deletions sorted by start, with a running maximum of the ends to their left.
 *
 * The tooltip's deletion tally is a STABBING query — "which deletions span this
 * bp" — not a lookup at a position, so a sorted start array alone doesn't bound
 * it: every deletion starting before the cursor is a candidate. `maxEndSoFar`
 * is what closes that. It is non-decreasing by construction, so walking left
 * from the last start at or before the cursor can stop the moment it drops to
 * or below the cursor: nothing further left reaches that far right either.
 *
 * Skips are filtered out HERE rather than at the query, both because the tally
 * is about deletions only and because an intron is exactly the long span that
 * would keep the bound loose for every deletion beside it.
 *
 * Built per call, with no cache. It used to be memoized in a `WeakMap` keyed on
 * `gapPositions`, which was the wrong shape twice over: the array it actually
 * indexes is `positions` below — allocated HERE, so the WeakMap entry was keyed
 * on one array and holding an index over another, and it could never be hit again
 * once that temporary was collected. What made it look like it worked is that
 * `gapPositions` outlives the call, so the entry stayed reachable while being
 * dead weight.
 *
 * The cost of dropping it is one pass over the gaps per hover, which is bounded
 * by DELETIONS in the block rather than by mismatches — orders of magnitude
 * smaller than the arrays the mismatch path cared about. If this ever shows up in
 * a trace, the fix is to have the worker ship the three arrays beside the sorted
 * gaps, not to reintroduce a side table keyed on an array it does not describe.
 */
interface DeletionSpanIndex {
  starts: Uint32Array
  ends: Uint32Array
  maxEndSoFar: Uint32Array
}

function deletionSpanIndex(gapPositions: Uint32Array, gapTypes: Uint8Array) {
  const n = Math.floor(gapPositions.length / 2)
  let deletions = 0
  for (let i = 0; i < n; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      deletions++
    }
  }
  const positions = new Uint32Array(deletions)
  const rawEnds = new Uint32Array(deletions)
  let w = 0
  for (let i = 0; i < n; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      positions[w] = gapPositions[i * 2]!
      rawEnds[w] = gapPositions[i * 2 + 1]!
      w++
    }
  }
  // `positionOrder`, not `positionIndexFor`: this owns `positions`, so there is
  // nothing for a memo to be keyed on that would outlive the call.
  const { order, sorted } = positionOrder(positions)
  const ends = new Uint32Array(deletions)
  const maxEndSoFar = new Uint32Array(deletions)
  let running = 0
  for (let k = 0; k < deletions; k++) {
    const end = rawEnds[order[k]!]!
    ends[k] = end
    if (end > running) {
      running = end
    }
    maxEndSoFar[k] = running
  }
  return { starts: sorted, ends, maxEndSoFar } satisfies DeletionSpanIndex
}

// Length stats for the deletions (gapTypes 0, as opposed to skips) spanning
// `position`. Same statistic as the interbase tally above, through the same
// accumulator, so the two can't compute it differently.
function collectDeletionStats(position: number, data: PileupDataResult) {
  const { gapPositions, gapTypes } = data
  const { starts, ends, maxEndSoFar } = deletionSpanIndex(
    gapPositions,
    gapTypes,
  )
  let acc: LengthAccumulator | undefined
  for (let k = lowerBound(starts, position + 1) - 1; k >= 0; k--) {
    if (maxEndSoFar[k]! <= position) {
      break
    }
    if (ends[k]! > position) {
      acc = accumulateLength(acc, ends[k]! - starts[k]!)
    }
  }
  return acc && toLengthStats(acc)
}

// Interbase events at `position`, or undefined when there are none. An empty
// tally is the "nothing to report" answer for both the hover and the click: with
// no entry the tooltip table and the detail widget would be a bare title, so
// neither should appear.
export function getInterbaseBin(
  position: number,
  blockRpcData: PileupDataResult | undefined,
): InterbaseBin | undefined {
  if (!blockRpcData) {
    return undefined
  }
  const interbase = collectInterbaseStats(position, blockRpcData)
  if (Object.keys(interbase).length === 0) {
    return undefined
  }
  const binIdx = Math.floor(position - blockRpcData.coverageStartPos)
  return {
    position,
    depth: blockRpcData.coverageDepths[binIdx] ?? 0,
    interbase,
    interbaseDepth: interbaseDepthAt(
      blockRpcData.coverageDepths,
      blockRpcData.coverageStartPos,
      position,
    ),
  }
}

export function getCoverageBin(
  position: number,
  blockRpcData: PileupDataResult | undefined,
): CoverageBin | undefined {
  if (!blockRpcData) {
    return undefined
  }
  const binIdx = Math.floor(position - blockRpcData.coverageStartPos)
  const depth = blockRpcData.coverageDepths[binIdx] ?? 0
  const hasStrandDepths = blockRpcData.coverageFwdDepths.length > 0
  const fwdDepth = hasStrandDepths
    ? (blockRpcData.coverageFwdDepths[binIdx] ?? 0)
    : undefined
  const revDepth = hasStrandDepths
    ? (blockRpcData.coverageRevDepths[binIdx] ?? 0)
    : undefined

  const snps = countSnpsAtPosition(position, blockRpcData)
  const deletions = collectDeletionStats(position, blockRpcData)
  const modifications = modTooltipEntriesAt(blockRpcData, position)

  const hasData =
    depth > 0 ||
    Object.keys(snps).length > 0 ||
    deletions !== undefined ||
    modifications !== undefined
  if (!hasData) {
    return undefined
  }

  return {
    position,
    depth,
    fwdDepth,
    revDepth,
    snps,
    deletions,
    modifications,
  }
}

// "18(+) 22(-)", or nothing when the sweep collected no per-strand tally — a
// row reporting "0(+) 0(-)" for want of the data says something false.
function strandCounts(fwd: number, rev: number) {
  return fwd > 0 || rev > 0 ? `${fwd}(+) ${rev}(-)` : undefined
}

// One line of the coverage breakdown at a position. `color` is a
// modification's own; `base` names an allele, whose colour is looked up in the
// 256-entry CSS map only the tooltip holds.
export interface CoverageRow {
  key: string
  label: string
  color?: string
  base?: string
  reads: string
  avgProb?: string
  strands?: string
}

// The coverage breakdown at one position, in display order, for both the hover
// table and the click's detail widget.
export function coverageRows(bin: CoverageBin) {
  const { depth, fwdDepth, revDepth, snps, deletions, modifications } = bin
  // Descending by count, tie-broken by base: `Object.entries` is insertion
  // order, so the same locus listed its alleles differently after a pan.
  const snpEntries = Object.entries(snps).sort(
    ([aBase, a], [bBase, b]) => b.count - a.count || aBase.localeCompare(bBase),
  )
  const modEntries = modifications
    ? [...modifications].sort((a, b) => a.name.localeCompare(b.name))
    : []
  const totalStrands =
    fwdDepth !== undefined && revDepth !== undefined
      ? { fwd: fwdDepth, rev: revDepth }
      : undefined
  const rows: CoverageRow[] = [
    {
      key: 'total',
      label: 'Total',
      reads: `${depth}`,
      strands: totalStrands
        ? strandCounts(totalStrands.fwd, totalStrands.rev)
        : undefined,
    },
  ]
  // Modification rows sit alongside the allele rows rather than instead of
  // them: at a CpG the A/C/G/T breakdown and the methylation calls are exactly
  // the pair worth disambiguating.
  for (const mod of modEntries) {
    rows.push({
      key: `${mod.name}-${mod.color}`,
      label: mod.name,
      color: mod.color,
      reads: countOfTotal(mod.count, depth),
      avgProb: `${((mod.count > 0 ? mod.probabilityTotal / mod.count : 0) * 100).toFixed(1)}%`,
      strands: strandCounts(mod.fwd, mod.rev),
    })
  }
  // Reads carrying the reference allele: `depth` counts every read over the
  // position and `snps` holds mismatches only, so the difference is the count a
  // reader at a het site is after. No BASE — `regionSequence` never ships to
  // the main thread — and no row at all without an alt to weigh it against or a
  // depth to weigh it in.
  if (snpEntries.length > 0 && depth > 0) {
    const altReads = snpEntries.reduce((sum, [, d]) => sum + d.count, 0)
    const altFwd = snpEntries.reduce((sum, [, d]) => sum + d.fwd, 0)
    const altRev = snpEntries.reduce((sum, [, d]) => sum + d.rev, 0)
    rows.push({
      key: 'ref',
      label: 'Ref',
      reads: countOfTotal(Math.max(0, depth - altReads), depth),
      strands: totalStrands
        ? strandCounts(
            Math.max(0, totalStrands.fwd - altFwd),
            Math.max(0, totalStrands.rev - altRev),
          )
        : undefined,
    })
  }
  for (const [base, data] of snpEntries) {
    rows.push({
      key: base,
      label: base.toUpperCase(),
      base,
      reads: countOfTotal(data.count, depth),
      strands: strandCounts(data.fwd, data.rev),
    })
  }
  if (deletions) {
    rows.push({
      key: 'deletion',
      // A deleted base is absent from the read and so out of `depth`, which
      // makes the share one of depth + deletions.
      label: `Deletion (${formatLenRange(deletions.minLen, deletions.maxLen)})`,
      reads: countOfTotal(deletions.count, depth + deletions.count),
    })
  }
  return rows
}

export function formatIndicatorTooltip(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  refName: string | undefined,
): IndicatorTooltipPayload | undefined {
  const bin = getInterbaseBin(position, blockRpcData)
  return bin ? { type: 'indicator', bin, refName } : undefined
}

export function formatCoverageTooltip(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  refName: string | undefined,
): CoverageTooltipPayload | undefined {
  const bin = getCoverageBin(position, blockRpcData)
  return bin ? { type: 'coverage', bin, refName } : undefined
}

export function formatModificationTooltip(
  hit: ModificationHitResult,
  refName: string | undefined,
  snpBase?: string,
): ModificationTooltipPayload {
  return { type: 'modification', ...hit, refName, snpBase }
}

// Takes the junction fields of a computed SashimiArc (there is no sashimi hit
// test — the arcs are SVG paths with their own mouse handlers, so the overlay
// hands its own arc straight over).
export function formatSashimiTooltip(arc: {
  start: number
  end: number
  score: number
  strand: number
  refName: string
  motif: number
}): SashimiTooltipPayload {
  const { start, end, score, strand, refName, motif } = arc
  return {
    type: 'sashimi',
    start,
    end,
    score,
    strand: strand === 1 ? '+' : strand === -1 ? '-' : 'unknown',
    refName,
    motif: spliceMotifLabel(motif),
  }
}

// Unlike sashimi's, this comes from a hit test for MOST arcs: the ones painted
// into the canvas by both renderers have no per-path mouse handler to hand their
// own arc over, so `hitTestArcBand` has to find them first. The cross-region
// overlay is the exception and calls this directly, which is why the parameter
// is narrowed to the fields an arc's hover reports rather than the whole
// `ArcHitResult` — a seam-crossing arc then reads identically to one inside a
// region instead of getting a second formatter.
//
// The endpoints are ordered here rather than at the hit test, which reports them
// as the worker resolved them (mate 1, mate 2). A location range reads
// backwards otherwise, and the arc itself is symmetric — `arcKey` already
// treats the pair as ordered, so nothing downstream distinguishes them.
//
// UNLESS the two ends are on different chromosomes, where ordering them is
// meaningless and `min`/`max` over the two bp is a locstring naming one
// chromosome and a coordinate from another. `endRefName` is what separates the
// two cases: absent or equal, this is a range; different, it is two positions,
// and the partner chromosome is exactly what a tick's hover was worth more than
// an arc's before the arc could be drawn at all.
export function formatArcTooltip(
  hit: Pick<ArcHitResult, 'x1' | 'x2' | 'support' | 'shapeType' | 'spanBp'>,
  refName: string,
  category: string | undefined,
  endRefName?: string,
): ArcTooltipPayload {
  if (endRefName !== undefined && endRefName !== refName) {
    return {
      type: 'arc',
      refName,
      // NOT ordered: `x1` belongs to `refName` and `x2` to `endRefName`, and
      // swapping them would put each coordinate under the other's chromosome.
      start: hit.x1,
      end: hit.x2,
      endRefName,
      support: hit.support,
      category,
    }
  }
  // The partner is off screen, so there is no range and no distance to print
  // between two coordinates — only where this end is and how far away the other
  // one was reported to be.
  if (isUnplacedArcShape(hit.shapeType)) {
    return {
      type: 'arc',
      refName,
      start: hit.x1,
      end: hit.x1,
      support: hit.support,
      category,
      unplacedPartnerBp: hit.spanBp,
    }
  }
  return {
    type: 'arc',
    refName,
    start: Math.min(hit.x1, hit.x2),
    end: Math.max(hit.x1, hit.x2),
    support: hit.support,
    category,
    // ARC_SHAPE_FLAT alone — the read cloud's placed MATE LINK, the one shape
    // whose `spanBp` is a template length. Deliberately not `isFlatArcShape`,
    // which is the right predicate for "does this draw as a bar" and the wrong
    // one for "does this have an insert size": it also admits
    // ARC_SHAPE_FLAT_SPLIT, and a split junction has no TLEN at all.
    // `computeArcShape` gives that arm `spanBp = |p2Bp - p1Bp|`, which is
    // exactly `end - start` above, so the row was the Distance line over again
    // under a name the read cannot support. The unplaced shape is handled
    // above, where the same number is the distance to a partner rather than a
    // template length a molecule had.
    //
    // A curve is excluded for the milder reason: its Y is the genomic radius,
    // half the span already shown.
    //
    // `spanBp`, NOT the `yBp` it draws at: the read cloud scales a line's Y by
    // a ±8% jitter so coincident pairs don't stack, and reading the drawn
    // position back reported that jittered number as the template length. The
    // hit no longer carries the drawn position at all.
    ...(hit.shapeType === ARC_SHAPE_FLAT ? { insertSize: hit.spanBp } : {}),
  }
}

// A connector tick's hover. `refName` is the region the tick is drawn in —
// which the hit result cannot carry, since the feed is bucketed by refName and
// each region's array holds only its own.
export function formatArcLineTooltip(
  hit: ArcLineHitResult,
  refName: string,
  partnerOffView: boolean,
): ArcLineTooltipPayload {
  return {
    type: 'arcLine',
    refName,
    position: hit.bp,
    partnerRefNames: hit.partnerRefNames,
    support: hit.support,
    partnerOffView,
  }
}

export interface TooltipFeatureInfo {
  id: string
  name: string
  start: number
  end: number
  strand: number
  refName: string
}

// "name chr1:1,001-1,100" for one read, for the bezier overlay's two-endpoint
// tooltip. The strand is opt-in and that overlay omits it: the curve's own color
// already encodes orientation, and two strands in one line reads as noise.
export function formatFeatureLabel(
  info: TooltipFeatureInfo,
  { showStrand = false } = {},
) {
  const label = `${info.name || info.id} ${formatLocationRange(info.refName, info.start, info.end)}`
  return showStrand ? `${label} (${info.strand === -1 ? '-' : '+'})` : label
}
