/**
 * Utility functions for WebGL alignments component
 *
 * Pure utility functions for coordinate transformation, formatting, color management,
 * and GPU data upload coordination.
 */

import { colord } from '@jbrowse/core/util/colord'

import { fillColor } from '../../shared/color.ts'

import type { ColorPalette, RGBColor, WebGLRenderer } from './WebGLRenderer'
import type { CigarHitResult } from './hitTesting'
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
    // Coverage color (light grey)
    colorCoverage: toRgb('#cccccc'),
    // Modification mode read colors
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
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
