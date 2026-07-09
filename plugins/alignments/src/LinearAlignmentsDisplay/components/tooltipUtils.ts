import {
  countSnpsAtPosition,
  formatInsertionLabel,
  interbaseDepthAt,
} from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

import { interbaseTypeName } from '../../shared/types.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type {
  CigarHitResult,
  SashimiArcHitResult,
} from '../../shared/hitTestTypes.ts'
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

export interface ModificationTooltipPayload {
  type: 'modification'
  modType?: string
  probability: number
  color: string
  refName?: string
  position: number
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

function getPairTypeDescription(
  flags: number,
  pairOrientation: number,
  insertSize: number,
  insertSizeStats?: { upper: number; lower: number },
  nextRef?: string,
  refName?: string,
) {
  if (flags & 8) {
    return 'Unmapped mate'
  }
  if (nextRef && refName && nextRef !== refName && nextRef !== '=') {
    return `Inter-chromosomal (mate on ${nextRef})`
  }
  if (pairOrientation > 1) {
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
    return `Abnormal orientation (${name})`
  }
  const tlen = Math.abs(insertSize)
  if (insertSizeStats) {
    if (tlen > insertSizeStats.upper) {
      return 'Long insert size'
    }
    if (tlen < insertSizeStats.lower) {
      return 'Short insert size'
    }
  }
  return undefined
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

  const lines = [
    `<b>${name}</b>`,
    `${refName}:${start.toLocaleString()}-${end.toLocaleString()}`,
  ]

  if (insertSize !== 0) {
    lines.push(`Template length: ${Math.abs(insertSize).toLocaleString()}`)
  }

  const orientName = PAIR_ORIENTATION_NAMES[pairOrientation]
  if (orientName) {
    lines.push(`Pair orientation: ${orientName}`)
  }

  const nextRef = rpcData.readNextRefs?.[idx] ?? ''
  const pairDesc = getPairTypeDescription(
    flags,
    pairOrientation,
    insertSize,
    rpcData.insertSizeStats,
    nextRef,
    refName,
  )
  if (pairDesc) {
    lines.push(pairDesc)
  }

  if (flags & 2048) {
    lines.push('Supplementary alignment')
  }

  return lines.join('<br>')
}

export function formatCigarTooltip(cigarHit: CigarHitResult) {
  const pos = toLocale(cigarHit.position + 1)
  switch (cigarHit.type) {
    case 'mismatch':
      return `SNP: ${cigarHit.base} at ${pos}`
    case 'insertion':
      return `${formatInsertionLabel(cigarHit.length ?? 0, cigarHit.sequence)} at ${pos}`
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

  const interbase: CoverageTooltipBin['interbase'] = {}
  if (includeInterbase) {
    const {
      interbasePositions,
      interbaseLengths,
      interbaseTypes,
      interbaseSequences,
    } = blockRpcData
    const numInterbases = interbasePositions.length
    // avgLen accumulates the length sum during the scan and is divided by count
    // in the finalize pass below. seqCountsByType tracks per-type sequence
    // tallies to surface the most common inserted sequence.
    const seqCountsByType = new Map<string, Map<string, number>>()
    for (let i = 0; i < numInterbases; i++) {
      if (interbasePositions[i] === position) {
        const typeName = interbaseTypeName(interbaseTypes[i]!)
        const len = interbaseLengths[i]!
        const entry = (interbase[typeName] ??= {
          count: 0,
          minLen: len,
          maxLen: len,
          avgLen: 0,
        })
        entry.count++
        entry.avgLen += len
        if (len < entry.minLen) {
          entry.minLen = len
        }
        if (len > entry.maxLen) {
          entry.maxLen = len
        }
        const seq = interbaseSequences[i]
        if (seq) {
          let typeSeqs = seqCountsByType.get(typeName)
          if (!typeSeqs) {
            typeSeqs = new Map()
            seqCountsByType.set(typeName, typeSeqs)
          }
          typeSeqs.set(seq, (typeSeqs.get(seq) ?? 0) + 1)
        }
      }
    }
    for (const [typeName, entry] of Object.entries(interbase)) {
      entry.avgLen /= entry.count
      const typeSeqs = seqCountsByType.get(typeName)
      if (typeSeqs) {
        let topSeq: string | undefined
        let topCount = 0
        for (const [seq, count] of typeSeqs) {
          if (count > topCount) {
            topCount = count
            topSeq = seq
          }
        }
        if (topSeq) {
          entry.topSeq = topSeq
          entry.topSeqCount = topCount
        }
      }
    }
  }

  let deletions: CoverageTooltipBin['deletions']
  let deletionLenSum = 0
  const { gapPositions, gapTypes } = blockRpcData
  const numGaps = gapPositions.length / 2
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] !== 0) {
      continue
    }
    const start = gapPositions[i * 2]!
    const end = gapPositions[i * 2 + 1]!
    if (position >= start && position < end) {
      const len = end - start
      deletions ??= { count: 0, minLen: len, maxLen: len, avgLen: 0 }
      deletions.count++
      deletionLenSum += len
      if (len < deletions.minLen) {
        deletions.minLen = len
      }
      if (len > deletions.maxLen) {
        deletions.maxLen = len
      }
    }
  }
  if (deletions) {
    deletions.avgLen = deletionLenSum / deletions.count
  }

  const modifications = blockRpcData.modTooltipData?.[position]
    ? { ...blockRpcData.modTooltipData[position] }
    : undefined

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
  position: number,
  modType: string | undefined,
  probability: number,
  color: string,
  refName: string | undefined,
  snpBase?: string,
): ModificationTooltipPayload {
  return {
    type: 'modification',
    modType,
    probability,
    color,
    refName,
    position,
    snpBase,
  }
}

// 1-based inclusive display range for a sashimi junction's half-open
// [start, end) intron span. Renders `start + 1` to match formatLocation /
// formatCigarTooltip and the detail widget (openSashimiWidget stores the raw
// 0-based start, which BaseFeatureDetail then shows as start + 1) — so the hover
// and the click-through can't disagree on the coordinate.
export function formatSashimiLocation(
  refName: string,
  start: number,
  end: number,
) {
  return `${refName}:${toLocale(start + 1)}-${toLocale(end)}`
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

export function formatFeatureTooltip(
  featureId: string,
  getFeatureInfoById: (id: string) =>
    | {
        id: string
        name: string
        start: number
        end: number
        strand: number
        refName: string
      }
    | undefined,
) {
  const info = getFeatureInfoById(featureId)
  if (info) {
    const strand = info.strand === -1 ? '-' : '+'
    return `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()} (${strand})`
  }
  return undefined
}
