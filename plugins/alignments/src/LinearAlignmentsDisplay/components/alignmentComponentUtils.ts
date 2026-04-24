/**
 * Utility functions for WebGL alignments component
 *
 * Pure utility functions for coordinate transformation, formatting, color management,
 * and GPU data upload coordination.
 */

import { countSnpsAtPosition } from '@jbrowse/alignments-core'

import { toRgb } from './shaders/colors.ts'
import { fillColor } from '../../shared/color.ts'

import type { CigarHitResult, SashimiArcHitResult } from './hitTesting'
import type { ColorPalette } from './shaders/colors.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'
import type { Theme } from '@mui/material'

/**
 * Build a ColorPalette from the MUI theme
 */
export function buildColorPaletteFromTheme(theme: Theme): ColorPalette {
  const { palette } = theme
  return {
    // Read/alignment colors from shared/color.ts
    colorFwdStrand: toRgb(fillColor.color_fwd_strand),
    colorRevStrand: toRgb(fillColor.color_rev_strand),
    colorNostrand: toRgb(fillColor.color_nostrand),
    colorPairLR: toRgb(fillColor.color_pair_lr),
    colorPairRL: toRgb(fillColor.color_pair_rl),
    colorPairRR: toRgb(fillColor.color_pair_rr),
    colorPairLL: toRgb(fillColor.color_pair_ll),
    // Base colors from theme
    colorBaseA: toRgb(palette.bases.A.main),
    colorBaseC: toRgb(palette.bases.C.main),
    colorBaseG: toRgb(palette.bases.G.main),
    colorBaseT: toRgb(palette.bases.T.main),
    // Indel/clip colors from theme
    colorInsertion: toRgb(palette.insertion),
    colorDeletion: toRgb(palette.deletion),
    colorSkip: toRgb(palette.skip),
    colorSoftclip: toRgb(palette.softclip),
    colorHardclip: toRgb(palette.hardclip),
    colorCoverage: toRgb(palette.coverage),
    // Modification mode read colors
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
    colorMutedSnpBase: toRgb(palette.mutedSnpBase),
    // Insert size colors
    colorLongInsert: toRgb(fillColor.color_longinsert),
    colorShortInsert: toRgb(fillColor.color_shortinsert),
    colorSupplementary: toRgb(fillColor.color_supplementary),
    colorUnmappedMate: toRgb(fillColor.color_unmapped_mate),
  }
}

/**
 * Convert canvas coordinates to genomic coordinates within a resolved block.
 * Used for all hit testing.
 */
export function canvasToGenomicCoords(
  canvasX: number,
  canvasY: number,
  resolved: {
    rpcData: PileupDataResult
    bpRange: [number, number]
    blockStartPx: number
    blockWidth: number
    reversed?: boolean
  },
  featureHeight: number,
  featureSpacing: number,
  topOffset: number,
  rangeY: [number, number],
) {
  const { bpRange, blockStartPx, blockWidth } = resolved
  const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
  const frac = (canvasX - blockStartPx) / blockWidth
  const genomicPos = resolved.reversed
    ? bpRange[1] - frac * (bpRange[1] - bpRange[0])
    : bpRange[0] + frac * (bpRange[1] - bpRange[0])
  const rowHeight = featureHeight + featureSpacing
  const scrolledY = canvasY + rangeY[0]
  const adjustedY = scrolledY - topOffset
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, row, adjustedY, yWithinRow }
}

/**
 * Get canvas coordinates from a mouse event, with smart bounding rect caching.
 * Uses 100ms cache timeout to catch scrolling and repositioning while being
 * efficient for rapid mousemove events.
 */
export function getCanvasCoords(
  e: React.MouseEvent,
  canvas: HTMLCanvasElement | null,
  canvasRectRef: React.RefObject<{ rect: DOMRect; timestamp: number } | null>,
) {
  if (!canvas) {
    return undefined
  }

  const now = Date.now()
  const cached = canvasRectRef.current

  // Invalidate cache if older than 100ms (catches scroll events and repositioning)
  if (cached && now - cached.timestamp < 100) {
    return {
      canvasX: e.clientX - cached.rect.left,
      canvasY: e.clientY - cached.rect.top,
    }
  }

  // Get fresh rect and cache it with timestamp
  const rect = canvas.getBoundingClientRect()
  canvasRectRef.current = { rect, timestamp: now }
  return { canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top }
}

export const CIGAR_TYPE_LABELS: Record<string, string> = {
  mismatch: 'SNP/Mismatch',
  insertion: 'Insertion',
  deletion: 'Deletion',
  skip: 'Skip (Intron)',
  softclip: 'Soft Clip',
  hardclip: 'Hard Clip',
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
  // Unmapped mate
  if (flags & 8) {
    return 'Unmapped mate'
  }
  // Inter-chromosomal mate
  if (nextRef && refName && nextRef !== refName && nextRef !== '=') {
    return `Inter-chromosomal (mate on ${nextRef})`
  }
  // Abnormal orientation (not LR)
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
  // Insert size classification
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

/**
 * Format chain/linked-read tooltip matching the canvas-based cloud display:
 * name, location, template length, pair type, supplementary indicator
 */
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

  // Check for supplementary alignment (flag 0x800)
  if (flags & 2048) {
    lines.push('Supplementary alignment')
  }

  return lines.join('<br>')
}

/**
 * Format a CIGAR hit result as human-readable tooltip text
 */
export function formatCigarTooltip(cigarHit: CigarHitResult) {
  const pos = cigarHit.position.toLocaleString()
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
    numInterbases,
  } = blockRpcData
  const typeNames = ['', 'insertion', 'softclip', 'hardclip']
  const interbaseSums = new Map<string, number>()
  const seqCounts = new Map<string, Map<string, number>>()
  for (let i = 0; i < numInterbases; i++) {
    if (interbasePositions[i] === position) {
      const typeName = typeNames[interbaseTypes[i]!] ?? 'insertion'
      const len = interbaseLengths[i]!
      if (!interbase[typeName]) {
        interbase[typeName] = {
          count: 0,
          minLen: len,
          maxLen: len,
          avgLen: 0,
        }
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
  const { gapPositions, gapTypes, numGaps } = blockRpcData
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] !== 0) {
      continue
    }
    const start = gapPositions[i * 2]!
    const end = gapPositions[i * 2 + 1]!
    if (position >= start && position < end) {
      const len = end - start
      if (!deletions) {
        deletions = { count: 0, minLen: len, maxLen: len, avgLen: 0 }
      }
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
