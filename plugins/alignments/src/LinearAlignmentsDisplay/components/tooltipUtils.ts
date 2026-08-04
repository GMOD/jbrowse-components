import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_SUPPLEMENTARY,
  countSnpsAtPosition,
  formatInsertionLabel,
  interbaseDepthAt,
} from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import { formatLocationRange } from '../../shared/locStrings.ts'
import { getCigarTypeLabel, interbaseTypeName } from '../../shared/types.ts'
import { getOrCreate } from '../../shared/util.ts'
import { accumulateLength, toLengthStats } from './lengthStats.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
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

export function formatChainTooltip(
  rpcData: PileupDataResult,
  idx: number,
  refName: string,
) {
  const name = rpcData.readNames[idx] ?? ''
  const start = rpcData.readPositions[idx * 2] ?? 0
  const end = rpcData.readPositions[idx * 2 + 1] ?? 0
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
      nextRef: rpcData.readNextRefs?.[idx] ?? '',
    }),
  )

  if (flags & SAM_FLAG_SUPPLEMENTARY) {
    lines.push('Supplementary alignment')
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
}): SashimiTooltipPayload {
  const { start, end, score, strand, refName } = arc
  return {
    type: 'sashimi',
    start,
    end,
    score,
    strand: strand === 1 ? '+' : strand === -1 ? '-' : 'unknown',
    refName,
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
