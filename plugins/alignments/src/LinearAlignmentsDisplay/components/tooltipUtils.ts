import {
  countSnpsAtPosition,
  formatInsertionLabel,
  interbaseDepthAt,
} from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import { formatLocationRange } from '../../shared/locStrings.ts'
import { interbaseTypeName } from '../../shared/types.ts'
import { getOrCreate } from '../../shared/util.ts'
import { accumulateLength, toLengthStats } from './lengthStats.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarHitResult,
  SashimiArcHitResult,
} from '../../shared/hitTestTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { LengthAccumulator } from './lengthStats.ts'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'

export interface IndicatorTooltipPayload {
  type: 'indicator'
  bin: CoverageTooltipBin
  refName?: string
}

export interface CoverageTooltipPayload {
  type: 'coverage'
  bin: CoverageTooltipBin
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

export function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

// "5bp" when the range collapses, "5-8bp" otherwise. Shared by the interbase,
// coverage, and deletion tooltip rows so they render length spans identically.
export function formatLenRange(minLen: number, maxLen: number) {
  return minLen === maxLen ? `${minLen}bp` : `${minLen}-${maxLen}bp`
}

const PAIR_ORIENTATION_NAMES = ['', 'LR', 'RL', 'RR', 'LL'] as const

function orientationDescription(pairOrientation: number) {
  const name = PAIR_ORIENTATION_NAMES[pairOrientation] ?? ''
  if (name === 'RR') {
    return 'Both mates reverse strand'
  }
  if (name === 'RL') {
    return 'Outward facing pair'
  }
  if (name === 'LL') {
    return 'Both mates forward strand'
  }
  return name ? `Abnormal orientation (${name})` : undefined
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
  if (flags & 8) {
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
  if (pairOrientation > 1) {
    const orient = orientationDescription(pairOrientation)
    if (orient) {
      out.push(orient)
    }
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

  if (flags & 2048) {
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
    case 'deletion':
      return `Deletion (${cigarHit.length}bp) at ${pos}`
    case 'skip':
      return `Skip/Intron (${cigarHit.length}bp) at ${pos}`
    case 'softclip':
      return `Soft clip (${cigarHit.length}bp) at ${pos}`
    case 'hardclip':
      return `Hard clip (${cigarHit.length}bp) at ${pos}`
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

export function getTooltipBin(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  // Interbase (insertion/softclip/hardclip) events at this position. The
  // coverage-depth tooltip omits them (false) — they're surfaced by hovering the
  // interbase histogram bars directly; the interbase/indicator tooltip keeps
  // them (true).
  includeInterbase = true,
): CoverageTooltipBin | undefined {
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

  const interbase = includeInterbase
    ? collectInterbaseStats(position, blockRpcData)
    : {}
  const deletions = collectDeletionStats(position, blockRpcData)
  const modifications = blockRpcData.modTooltipData?.[position]

  const hasData =
    depth > 0 ||
    Object.keys(snps).length > 0 ||
    Object.keys(interbase).length > 0 ||
    deletions !== undefined ||
    modifications !== undefined
  if (!hasData) {
    return undefined
  }

  const interbaseDepth = interbaseDepthAt(
    blockRpcData.coverageDepths,
    blockRpcData.coverageStartPos,
    position,
  )

  return {
    position,
    depth,
    fwdDepth,
    revDepth,
    interbaseDepth,
    snps,
    interbase,
    deletions,
    modifications,
  }
}

export function formatIndicatorTooltip(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  refName: string | undefined,
): IndicatorTooltipPayload | undefined {
  const bin = getTooltipBin(position, blockRpcData)
  if (bin) {
    return { type: 'indicator', bin, refName }
  }
  return undefined
}

export function formatCoverageTooltip(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  refName: string | undefined,
): CoverageTooltipPayload | undefined {
  const bin = getTooltipBin(position, blockRpcData, false)
  if (!bin) {
    return undefined
  }
  return { type: 'coverage', bin, refName }
}

export function formatModificationTooltip(
  hit: ModificationHitResult,
  refName: string | undefined,
  snpBase?: string,
): ModificationTooltipPayload {
  return { type: 'modification', ...hit, refName, snpBase }
}

export function formatSashimiTooltip(
  sashimiHit: SashimiArcHitResult,
): SashimiTooltipPayload {
  const strandLabel =
    sashimiHit.strand === 1 ? '+' : sashimiHit.strand === -1 ? '-' : 'unknown'
  return {
    type: 'sashimi',
    start: sashimiHit.start,
    end: sashimiHit.end,
    score: sashimiHit.score,
    strand: strandLabel,
    refName: sashimiHit.refName,
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
