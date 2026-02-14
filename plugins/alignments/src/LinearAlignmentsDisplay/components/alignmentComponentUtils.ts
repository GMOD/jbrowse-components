/**
 * Utility functions for WebGL alignments component
 *
 * Pure utility functions for coordinate transformation, formatting, color management,
 * and GPU data upload coordination.
 */

import { colord } from '@jbrowse/core/util/colord'

import { INTERBASE_TYPES } from './hitTesting.ts'
import { fillColor } from '../../shared/color.ts'

import type { ColorPalette, RGBColor, WebGLRenderer } from './WebGLRenderer'
import type {
  CigarHitResult,
  CoverageHitResult,
  IndicatorHitResult,
  SashimiArcHitResult,
} from './hitTesting'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types'
import type { Theme } from '@mui/material'

function toRgb(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}

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
    // Coverage color from theme grey palette
    colorCoverage: toRgb(
      palette.mode === 'dark' ? palette.grey[700] : palette.grey[400],
    ),
    // Modification mode read colors
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
    // Insert size colors
    colorLongInsert: toRgb(fillColor.color_longinsert),
    colorShortInsert: toRgb(fillColor.color_shortinsert),
    colorSupplementary: toRgb(fillColor.color_supplementary),
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
    rpcData: WebGLPileupDataResult
    bpRange: [number, number]
    blockStartPx: number
    blockWidth: number
  },
  featureHeight: number,
  featureSpacing: number,
  showCoverage: boolean,
  coverageHeight: number,
  rangeY: [number, number],
) {
  const { bpRange, blockStartPx, blockWidth, rpcData } = resolved
  const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
  const genomicPos = bpRange[0] + (canvasX - blockStartPx) * bpPerPx
  const posOffset = genomicPos - rpcData.regionStart
  const rowHeight = featureHeight + featureSpacing
  const scrolledY = canvasY + rangeY[0]
  const adjustedY = showCoverage ? scrolledY - coverageHeight : scrolledY
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, posOffset, row, adjustedY, yWithinRow }
}

/**
 * Get canvas coordinates from a mouse event, with smart bounding rect caching.
 * Uses 100ms cache timeout to catch scrolling and repositioning while being
 * efficient for rapid mousemove events.
 */
export function getCanvasCoords(
  e: React.MouseEvent,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvasRectRef: React.RefObject<{ rect: DOMRect; timestamp: number } | null>,
) {
  const canvas = canvasRef.current
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
  rpcData: WebGLPileupDataResult,
  idx: number,
  refName: string,
) {
  const name = rpcData.readNames[idx] ?? ''
  const startOffset = rpcData.readPositions[idx * 2]
  const endOffset = rpcData.readPositions[idx * 2 + 1]
  const start =
    startOffset !== undefined ? rpcData.regionStart + startOffset : 0
  const end = endOffset !== undefined ? rpcData.regionStart + endOffset : 0
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

export function formatIndicatorTooltip(
  indicatorHit: IndicatorHitResult,
  blockRpcData: WebGLPileupDataResult | undefined,
  refName: string | undefined,
) {
  const posOffset = indicatorHit.position - (blockRpcData?.regionStart ?? 0)
  const tooltipBin = blockRpcData?.tooltipData[posOffset]

  if (tooltipBin) {
    return JSON.stringify({
      type: 'indicator',
      bin: tooltipBin,
      refName,
    })
  }
  // Fallback: show basic counts when detailed bin data unavailable
  const { counts } = indicatorHit
  const total = counts.insertion + counts.softclip + counts.hardclip
  const interbaseData: Record<
    string,
    { count: number; minLen: number; maxLen: number; avgLen: number }
  > = {}
  for (const type of INTERBASE_TYPES) {
    if (counts[type] > 0) {
      interbaseData[type] = {
        count: counts[type],
        minLen: 0,
        maxLen: 0,
        avgLen: 0,
      }
    }
  }
  return JSON.stringify({
    type: 'indicator',
    bin: {
      position: indicatorHit.position,
      depth: total,
      interbase: interbaseData,
    },
    refName,
  })
}

export function formatCoverageTooltip(
  coverageHit: CoverageHitResult,
  blockRpcData: WebGLPileupDataResult | undefined,
  refName: string | undefined,
) {
  const posOffset = coverageHit.position - (blockRpcData?.regionStart ?? 0)
  const tooltipBin = blockRpcData?.tooltipData[posOffset]

  if (tooltipBin || coverageHit.depth > 0) {
    const bin = tooltipBin ?? {
      position: coverageHit.position,
      depth: coverageHit.depth,
      snps: {},
      interbase: {},
    }
    if (!tooltipBin && coverageHit.snps.length > 0) {
      for (const snp of coverageHit.snps) {
        if (
          snp.base === 'A' ||
          snp.base === 'C' ||
          snp.base === 'G' ||
          snp.base === 'T'
        ) {
          bin.snps[snp.base] = { count: snp.count, fwd: 0, rev: 0 }
        } else if (
          snp.base === 'insertion' ||
          snp.base === 'softclip' ||
          snp.base === 'hardclip'
        ) {
          bin.interbase[snp.base] = {
            count: snp.count,
            minLen: 0,
            maxLen: 0,
            avgLen: 0,
          }
        }
      }
    }

    return JSON.stringify({
      type: 'coverage',
      bin,
      refName,
    })
  }
  return undefined
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

/**
 * Upload all region data to GPU for rendering.
 * Coordinates uploading reads, CIGAR features, coverage, and sashimi arcs.
 */
export function uploadRegionDataToGPU(
  renderer: WebGLRenderer,
  rpcDataMap: Map<number, WebGLPileupDataResult>,
  showCoverage: boolean,
) {
  renderer.clearLegacyBuffers()
  let maxYVal = 0
  for (const [regionNumber, data] of rpcDataMap) {
    if (data.numReads === 0) {
      continue
    }
    renderer.uploadFromTypedArraysForRegion(regionNumber, data)
    renderer.uploadCigarFromTypedArraysForRegion(regionNumber, data)
    renderer.uploadModificationsFromTypedArraysForRegion(regionNumber, data)
    if (data.maxY > maxYVal) {
      maxYVal = data.maxY
    }
    if (showCoverage) {
      renderer.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
      renderer.uploadModCoverageFromTypedArraysForRegion(regionNumber, data)
      if (data.numSashimiArcs > 0) {
        renderer.uploadSashimiFromTypedArraysForRegion(regionNumber, data)
      }
    }
  }
  return maxYVal
}
