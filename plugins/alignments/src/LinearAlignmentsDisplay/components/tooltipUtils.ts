import { countSnpsAtPosition } from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types'
import type {
  CigarHitResult,
  SashimiArcHitResult,
} from '../../shared/hitTestTypes.ts'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'

export function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
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
      return cigarHit.sequence && cigarHit.sequence.length <= 20
        ? `Insertion (${cigarHit.length}bp): ${cigarHit.sequence} at ${pos}`
        : `Insertion (${cigarHit.length}bp) at ${pos}`
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
): CoverageTooltipBin | undefined {
  if (!blockRpcData) {
    return undefined
  }
  const binIdx = Math.floor(position - blockRpcData.coverageStartPos)
  const depth = blockRpcData.coverageDepths[binIdx] ?? 0

  const snps = countSnpsAtPosition(position, blockRpcData)

  const interbase: CoverageTooltipBin['interbase'] = {}
  const {
    interbasePositions,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
  } = blockRpcData
  const numInterbases = interbasePositions.length
  const typeNames = ['', 'insertion', 'softclip', 'hardclip']
  const interbaseSums = new Map<string, number>()
  const seqCounts = new Map<string, Map<string, number>>()
  for (let i = 0; i < numInterbases; i++) {
    if (interbasePositions[i] === position) {
      const typeName = typeNames[interbaseTypes[i]!] ?? 'insertion'
      const len = interbaseLengths[i]!
      interbase[typeName] ??= {
        count: 0,
        minLen: len,
        maxLen: len,
        avgLen: 0,
      }
      const entry = interbase[typeName]
      entry.count++
      interbaseSums.set(typeName, (interbaseSums.get(typeName) ?? 0) + len)
      if (len < entry.minLen) {
        entry.minLen = len
      }
      if (len > entry.maxLen) {
        entry.maxLen = len
      }
      const seq = interbaseSequences[i]
      if (seq) {
        let typeSeqs = seqCounts.get(typeName)
        if (!typeSeqs) {
          typeSeqs = new Map()
          seqCounts.set(typeName, typeSeqs)
        }
        typeSeqs.set(seq, (typeSeqs.get(seq) ?? 0) + 1)
      }
    }
  }
  for (const [typeName, entry] of Object.entries(interbase)) {
    entry.avgLen = (interbaseSums.get(typeName) ?? 0) / entry.count
    const typeSeqs = seqCounts.get(typeName)
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

  const leftDepth = blockRpcData.coverageDepths[binIdx - 1] ?? 0
  const rightDepth = blockRpcData.coverageDepths[binIdx] ?? 0
  const interbaseDepth = Math.max(leftDepth, rightDepth)

  return {
    position,
    depth,
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
) {
  const bin = getTooltipBin(position, blockRpcData)
  if (bin) {
    return JSON.stringify({ type: 'indicator', bin, refName })
  }
  return undefined
}

export function formatCoverageTooltip(
  position: number,
  blockRpcData: PileupDataResult | undefined,
  refName: string | undefined,
  modType?: string,
) {
  const bin = getTooltipBin(position, blockRpcData)
  if (!bin) {
    return undefined
  }
  const filteredBin =
    modType && bin.modifications?.[modType]
      ? { ...bin, modifications: { [modType]: bin.modifications[modType] } }
      : bin
  return JSON.stringify({ type: 'coverage', bin: filteredBin, refName })
}

export function formatModificationTooltip(
  position: number,
  modType: string | undefined,
  probability: number,
  color: string,
  refName: string | undefined,
  snpBase?: string,
) {
  return JSON.stringify({
    type: 'modification',
    modType,
    probability,
    color,
    refName,
    position,
    snpBase,
  } satisfies ModificationTooltipPayload)
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

export function formatSashimiTooltip(sashimiHit: SashimiArcHitResult) {
  const strandLabel =
    sashimiHit.strand === 1 ? '+' : sashimiHit.strand === -1 ? '-' : 'unknown'
  return JSON.stringify({
    type: 'sashimi',
    start: sashimiHit.start,
    end: sashimiHit.end,
    score: sashimiHit.score,
    strand: strandLabel,
    refName: sashimiHit.refName,
  })
}

export function formatFeatureTooltip(
  featureId: string,
  getFeatureInfoById: (id: string) =>
    | {
        id: string
        name: string
        start: number
        end: number
        strand: string
        refName: string
      }
    | undefined,
) {
  const info = getFeatureInfoById(featureId)
  if (info) {
    return `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()} (${info.strand})`
  }
  return undefined
}
