import {
  countSnpsAtPosition,
  formatInsertionLabel,
  interbaseDepthAt,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { toLocale } from '@jbrowse/core/util'

import { ARC_SHAPE_FLAT } from '../../features/arcs/compute.ts'
import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import { formatLocationRange } from '../../shared/locStrings.ts'
import { readNameAt } from '../../shared/readNameBlock.ts'
import { nextRefAt } from '../../shared/readNextRefs.ts'
import { getCigarTypeLabel, interbaseTypeName } from '../../shared/types.ts'
import { getOrCreate } from '../../shared/util.ts'
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
  // Empty when the junction has no single strand to report — a split-read
  // junction joins two segments whose strands may differ, and the connection
  // type in `title` is what carries that instead. The renderer omits the row.
  strand: string
  refName: string
  // Equal to `refName` unless the junction crosses chromosomes, which only a
  // split-read junction can. The renderer prints two loci and no length in that
  // case: subtracting coordinates on two number lines is not a distance.
  endRefName: string
  // What to head the tooltip with — 'Intron/Skip' for a splice junction, the
  // connection's own name for a split one. See `SashimiArc.title`.
  title: string
}

export interface ArcTooltipPayload {
  type: 'arc'
  refName: string
  // The two endpoints in absolute genomic bp, already ordered left-to-right.
  start: number
  end: number
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
}

// "Supported by 1 read" / "Supported by 12 reads". Singular at 1 so a lone
// connection does not read as a suspiciously weak junction.
export function supportLabel(support: number) {
  return support === 1
    ? 'Supported by 1 read'
    : `Supported by ${toLocale(support)} reads`
}

// HTML/plain strings come from formatChainTooltip / formatCigarTooltip /
// formatFeatureTooltip / arcTooltip; structured payloads come from the other
// formatters. The consumer dispatches on typeof + .type.
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
 * The chain-mode hover, and the one place that names a read's COLOR.
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
export function formatChainTooltip(
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

  const lines = [`<b>${name}</b>`, formatLocationRange(refName, start, end)]

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
      // qual 0 = no base quality reported; omit rather than show a bare "Q0".
      const qual = cigarHit.qual ? ` (Q${cigarHit.qual})` : ''
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
  for (let i = 0; i < interbasePositions.length; i++) {
    if (interbasePositions[i] === position) {
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
    }
  }
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

// Length stats for the deletions (gapTypes 0, as opposed to skips) spanning
// `position`. Same statistic as the interbase tally above, through the same
// accumulator, so the two can't compute it differently.
function collectDeletionStats(position: number, data: PileupDataResult) {
  const { gapPositions, gapTypes } = data
  let acc: LengthAccumulator | undefined
  for (let i = 0; i < gapPositions.length / 2; i++) {
    const start = gapPositions[i * 2]!
    const end = gapPositions[i * 2 + 1]!
    if (gapTypes[i] === 0 && position >= start && position < end) {
      acc = accumulateLength(acc, end - start)
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
  const modifications = blockRpcData.modTooltipData?.[position]

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
  endRefName: string
  title: string
}): SashimiTooltipPayload {
  const { start, end, score, strand, refName, endRefName, title } = arc
  return {
    type: 'sashimi',
    start,
    end,
    score,
    // '' rather than 'unknown', which is a row that costs a line to say
    // nothing. Reached by an unstranded splice junction as well as by every
    // split-read junction, and it was never worth printing for either.
    strand: strand === 1 ? '+' : strand === -1 ? '-' : '',
    refName,
    endRefName,
    title,
  }
}

// Unlike sashimi's, this one DOES come from a hit test: read-connection arcs are
// painted into the canvas by both renderers, so there is no per-path mouse
// handler to hand its own arc over and `hitTestArcs` has to find it first.
//
// The endpoints are ordered here rather than at the hit test, which reports them
// as the worker resolved them (mate 1, mate 2). A location range reads
// backwards otherwise, and the arc itself is symmetric — `arcKey` already
// treats the pair as ordered, so nothing downstream distinguishes them.
export function formatArcTooltip(
  // The fields an arc's hover actually reports, rather than the whole
  // `ArcHitResult`: the cross-region overlay has no `ArcsUploadData` to have
  // been indexed into, so it can supply every number below and neither `kind`
  // nor `index`. Narrowing the parameter is what lets a seam-crossing arc read
  // identically to one inside a region instead of getting a second formatter.
  hit: Pick<ArcHitResult, 'x1' | 'x2' | 'support' | 'shapeType' | 'spanBp'>,
  refName: string,
  category: string | undefined,
): ArcTooltipPayload {
  return {
    type: 'arc',
    refName,
    start: Math.min(hit.x1, hit.x2),
    end: Math.max(hit.x1, hit.x2),
    support: hit.support,
    category,
    // ARC_SHAPE_FLAT alone — the read cloud's MATE LINK, the one shape whose
    // `spanBp` is a template length. Deliberately not `isFlatArcShape`, which
    // is the right predicate for "does this draw as a bar" and the wrong one
    // for "does this have an insert size": it also admits ARC_SHAPE_FLAT_SPLIT,
    // and a split junction has no TLEN at all. `computeArcShape` gives that arm
    // `spanBp = |p2Bp - p1Bp|`, which is exactly `end - start` above, so the row
    // was the Distance line over again under a name the read cannot support.
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
): ArcLineTooltipPayload {
  return {
    type: 'arcLine',
    refName,
    position: hit.bp,
    partnerRefNames: hit.partnerRefNames,
    support: hit.support,
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

// "name chr1:1,001-1,100" for one read, shared by the plain pileup hover and the
// bezier overlay's two-endpoint tooltip so neither re-spells the location. The
// pileup hover appends the strand; the bezier tooltip omits it (the curve's own
// color already encodes orientation, and two strands in one line reads as noise).
export function formatFeatureLabel(
  info: TooltipFeatureInfo,
  { showStrand = false } = {},
) {
  const label = `${info.name || info.id} ${formatLocationRange(info.refName, info.start, info.end)}`
  return showStrand ? `${label} (${info.strand === -1 ? '-' : '+'})` : label
}

export function formatFeatureTooltip(
  featureId: string,
  getFeatureInfoById: (id: string) => TooltipFeatureInfo | undefined,
) {
  const info = getFeatureInfoById(featureId)
  return info ? formatFeatureLabel(info, { showStrand: true }) : undefined
}
