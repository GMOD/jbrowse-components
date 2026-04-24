/**
 * Hit testing utilities for WebGL alignments display
 *
 * These functions test whether the mouse position hits various visual elements:
 * - Features (reads/alignments)
 * - CIGAR items (mismatches, insertions, deletions, clips)
 * - Coverage area (coverage bars and SNP segments)
 * - Indicators (interbase insertion/softclip/hardclip triangles)
 * - Sashimi arcs (splice junctions)
 *
 * All hit tests work in canvas coordinates and return genomic position data
 * for tooltip and selection purposes.
 */

import { abgrAlpha, abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'
import Flatbush from '@jbrowse/core/util/flatbush'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
} from '../constants.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types'

// Types for CIGAR item hit testing
export type CigarItemType =
  | 'mismatch'
  | 'insertion'
  | 'deletion'
  | 'skip'
  | 'softclip'
  | 'hardclip'

export interface CigarHitResult {
  type: CigarItemType
  index: number
  position: number // genomic position
  length?: number
  base?: string // for mismatches
  sequence?: string // for insertions
}

// Types for coverage area hit testing
export interface CoverageHitResult {
  type: 'coverage'
  position: number
}

export interface ModificationHitResult {
  position: number
  modType: string | undefined
  probability: number
  color: string
}

export interface IndicatorHitResult {
  type: 'indicator'
  position: number
  indicatorType: 'insertion' | 'softclip' | 'hardclip'
}

// Types for sashimi arc hit testing
export interface SashimiArcHitResult {
  start: number
  end: number
  score: number
  strand: number
  refName: string
}

// Internal types for hit testing
export interface ResolvedBlock {
  rpcData: PileupDataResult
  bpRange: [number, number]
  blockStartPx: number
  blockWidth: number
  refName: string
  reversed: boolean
}

export interface CigarCoords {
  bpPerPx: number
  genomicPos: number
  row: number
  adjustedY: number
  yWithinRow: number
}

// Constants for interbase types
export const INTERBASE_TYPES = ['insertion', 'softclip', 'hardclip'] as const
export type InterbaseType = (typeof INTERBASE_TYPES)[number]

/**
 * Helper: Calculate base pairs per pixel for a block
 */
function calculateBpPerPx(
  bpRange: [number, number],
  blockWidth: number,
): number {
  return (bpRange[1] - bpRange[0]) / blockWidth
}

/**
 * Helper: Convert canvas X coordinate to genomic position.
 * When reversed, left edge of the block corresponds to bpRange[1].
 */
function canvasXToGenomicPosition(
  canvasX: number,
  resolved: ResolvedBlock,
): number {
  const { bpRange, blockStartPx, blockWidth } = resolved
  const frac = (canvasX - blockStartPx) / blockWidth
  return resolved.reversed
    ? bpRange[1] - frac * (bpRange[1] - bpRange[0])
    : bpRange[0] + frac * (bpRange[1] - bpRange[0])
}

/**
 * Helper: Convert canvas X coordinate to position offset within region
 */
function canvasXToGenomicPos(
  canvasX: number,
  resolved: ResolvedBlock,
): { genomicPos: number; bpPerPx: number } {
  const { bpRange, blockWidth } = resolved
  const bpPerPx = calculateBpPerPx(bpRange, blockWidth)
  const genomicPos = canvasXToGenomicPosition(canvasX, resolved)
  return { genomicPos, bpPerPx }
}

/**
 * Helper: Map interbase color type (1-3) to type name
 */
function getInterbaseTypeName(colorType: number): InterbaseType {
  return INTERBASE_TYPES[(colorType - 1) % 3] ?? 'insertion'
}

// Cache reconstructed Flatbush instances keyed by their ArrayBuffer
const flatbushCache = new WeakMap<ArrayBuffer, Flatbush>()

function getOrCreateFlatbush(data: ArrayBuffer) {
  let fb = flatbushCache.get(data)
  if (!fb) {
    fb = Flatbush.from(data)
    flatbushCache.set(data, fb)
  }
  return fb
}

/**
 * Hit test for a chain (linked read group) using a Flatbush spatial index.
 * Each chain is stored as a bounding box (minStart to maxEnd, at chain row).
 * Returns the first read in the hit chain.
 */
export function hitTestChain(
  coords: CigarCoords | undefined,
  rpcData: PileupDataResult | undefined,
) {
  if (
    !coords ||
    !rpcData?.chainFlatbushData ||
    !rpcData.chainFirstReadIndices
  ) {
    return undefined
  }

  const { adjustedY, genomicPos, row } = coords
  if (adjustedY < 0) {
    return undefined
  }

  const fb = getOrCreateFlatbush(rpcData.chainFlatbushData)
  const hits = fb.search(genomicPos, row, genomicPos, row)
  if (hits.length === 0) {
    return undefined
  }
  const readIdx = rpcData.chainFirstReadIndices[hits[0]!]!
  return { id: rpcData.readIds[readIdx]!, index: readIdx }
}

/**
 * Hit test for a feature (read/alignment) at the given canvas coordinates.
 * Returns feature ID and index if hit, undefined otherwise.
 */
export function hitTestFeature(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeightSetting: number,
): { id: string; index: number } | undefined {
  if (!resolved || !coords) {
    return undefined
  }

  const { adjustedY, yWithinRow, genomicPos, row } = coords

  if (adjustedY < 0) {
    return undefined
  }

  const { readPositions, readYs, readIds, numReads } = resolved.rpcData

  if (yWithinRow > featureHeightSetting) {
    return undefined
  }

  for (let i = 0; i < numReads; i++) {
    if (readYs[i] !== row) {
      continue
    }
    const readStart = readPositions[i * 2]
    const readEnd = readPositions[i * 2 + 1]
    if (
      readStart !== undefined &&
      readEnd !== undefined &&
      genomicPos >= readStart &&
      genomicPos <= readEnd
    ) {
      return { id: readIds[i]!, index: i }
    }
  }
  return undefined
}

/**
 * Hit test for CIGAR items (mismatches, insertions, deletions, clips)
 */
export function hitTestCigarItem(
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeightSetting: number,
): CigarHitResult | undefined {
  if (!resolved || !coords) {
    return undefined
  }

  const { bpPerPx, genomicPos, row, adjustedY, yWithinRow } = coords

  if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
    return undefined
  }

  const blockData = resolved.rpcData

  const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

  // Check mismatches first (1bp features covering [pos, pos+1))
  const {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    numMismatches,
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseSequences,
    numInterbases,
    gapPositions,
    gapYs,
    numGaps,
  } = blockData

  const pxPerBp = 1 / bpPerPx

  function checkInsertionHit(sizeFilter: 'small' | 'large') {
    for (let i = 0; i < numInterbases; i++) {
      if (interbaseTypes[i] !== INTERBASE_INSERTION || interbaseYs[i] !== row) {
        continue
      }
      const pos = interbasePositions[i]
      if (pos !== undefined) {
        const len = interbaseLengths[i] ?? 0
        const isSmall = getInsertionType(len, pxPerBp) === 'small'
        if (sizeFilter === 'small' ? isSmall : !isSmall) {
          const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
          const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
          if (Math.abs(genomicPos - pos) < rectHalfWidthBp) {
            return {
              type: 'insertion' as const,
              index: i,
              position: pos,
              length: len,
              sequence: interbaseSequences[i] || undefined,
            }
          }
        }
      }
    }
    return undefined
  }

  function checkClipHit(
    clipType: typeof INTERBASE_SOFTCLIP | typeof INTERBASE_HARDCLIP,
    label: 'softclip' | 'hardclip',
  ) {
    for (let i = 0; i < numInterbases; i++) {
      if (interbaseTypes[i] !== clipType || interbaseYs[i] !== row) {
        continue
      }
      const pos = interbasePositions[i]
      const len = interbaseLengths[i]
      if (
        pos !== undefined &&
        len !== undefined &&
        Math.abs(genomicPos - pos) < hitToleranceBp
      ) {
        return {
          type: label,
          index: i,
          position: pos,
          length: len,
        }
      }
    }
    return undefined
  }

  // Large insertions first (wide boxes that overlap SNPs)
  const largeInsHit = checkInsertionHit('large')
  if (largeInsHit) {
    return largeInsHit
  }

  // Mismatches (1bp features - use floor to determine which base mouse is over)
  const mousePos = Math.floor(genomicPos)
  for (let i = 0; i < numMismatches; i++) {
    if (mismatchYs[i] !== row) {
      continue
    }
    const pos = mismatchPositions[i]
    if (pos !== undefined && mousePos === pos) {
      const baseCode = mismatchBases[i]!
      return {
        type: 'mismatch',
        index: i,
        position: pos,
        base: String.fromCharCode(baseCode),
      }
    }
  }

  // Small insertions (thin bars that don't overlap SNPs)
  const smallInsHit = checkInsertionHit('small')
  if (smallInsHit) {
    return smallInsHit
  }

  // Gaps (deletions/skips - have start and end)
  const { gapTypes } = blockData
  for (let i = 0; i < numGaps; i++) {
    if (gapYs[i] !== row) {
      continue
    }
    const startPos = gapPositions[i * 2]
    const endPos = gapPositions[i * 2 + 1]
    if (
      startPos !== undefined &&
      endPos !== undefined &&
      genomicPos >= startPos &&
      genomicPos <= endPos
    ) {
      const gapType = gapTypes[i]
      return {
        type: gapType === 1 ? 'skip' : 'deletion',
        index: i,
        position: startPos,
        length: endPos - startPos,
      }
    }
  }

  return (
    checkClipHit(INTERBASE_SOFTCLIP, 'softclip') ??
    checkClipHit(INTERBASE_HARDCLIP, 'hardclip')
  )
}

// Find the first significant position in [binStart, binEnd). "Significant"
// = at least `threshold` fraction of reads at that position, relative to
// the local coverage depth.
function findSignificantInBin(
  positions: Uint32Array,
  count: number,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) {
  const hitsByPos = new Map<number, number>()
  for (let i = 0; i < count; i++) {
    const pos = positions[i]!
    if (pos >= binStart && pos < binEnd) {
      hitsByPos.set(pos, (hitsByPos.get(pos) ?? 0) + 1)
    }
  }
  let best = -1
  for (const [pos, n] of hitsByPos) {
    const binIdx = Math.floor(pos - coverageStartPos)
    const depth = coverageDepths[binIdx]
    if (depth && n / depth > threshold && (best < 0 || pos < best)) {
      best = pos
    }
  }
  return best < 0 ? undefined : best
}

export function hitTestCoverage(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  showCoverage: boolean,
  coverageHeight: number,
): CoverageHitResult | undefined {
  if (!showCoverage || canvasY > coverageHeight || !resolved) {
    return undefined
  }

  const blockData = resolved.rpcData
  const { genomicPos, bpPerPx } = canvasXToGenomicPos(canvasX, resolved)

  const { coverageDepths, coverageStartPos } = blockData
  const binIndex = Math.floor(genomicPos - coverageStartPos)
  if (binIndex < 0 || binIndex >= coverageDepths.length) {
    return undefined
  }

  const binStart = coverageStartPos + binIndex
  if (bpPerPx > 1) {
    const binEnd = binStart + Math.ceil(bpPerPx)
    const snpHit = findSignificantInBin(
      blockData.mismatchPositions,
      blockData.numMismatches,
      coverageDepths,
      coverageStartPos,
      binStart,
      binEnd,
      0.05,
    )
    if (snpHit !== undefined) {
      return { type: 'coverage', position: snpHit }
    }
    const noncovHit = findSignificantInBin(
      blockData.interbasePositions,
      blockData.numInterbases,
      coverageDepths,
      coverageStartPos,
      binStart,
      binEnd,
      0.2,
    )
    if (noncovHit !== undefined) {
      return { type: 'coverage', position: noncovHit }
    }
  }

  return { type: 'coverage', position: binStart }
}

/**
 * Hit test for interbase indicators (triangles at top of coverage)
 */
export function hitTestIndicator(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  showCoverage: boolean,
  showInterbaseIndicators: boolean,
): IndicatorHitResult | undefined {
  if (!showCoverage || !showInterbaseIndicators || canvasY > 5 || !resolved) {
    return undefined
  }

  const blockData = resolved.rpcData
  const { genomicPos, bpPerPx } = canvasXToGenomicPos(canvasX, resolved)
  const hitToleranceBp = Math.max(1, bpPerPx * 5)

  const { indicatorPositions, indicatorColorTypes, numIndicators } = blockData

  for (let i = 0; i < numIndicators; i++) {
    const pos = indicatorPositions[i]
    if (pos !== undefined && Math.abs(genomicPos - pos) < hitToleranceBp) {
      const colorType = indicatorColorTypes[i]
      const indicatorType = getInterbaseTypeName(colorType ?? 1)
      return {
        type: 'indicator',
        position: pos,
        indicatorType,
      }
    }
  }

  return undefined
}

export function hitTestModification(
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeightSetting: number,
): ModificationHitResult | undefined {
  if (!resolved || !coords) {
    return undefined
  }
  const { row, yWithinRow, genomicPos, bpPerPx } = coords
  if (yWithinRow > featureHeightSetting || !resolved.rpcData.modFlatbush) {
    return undefined
  }
  const hitToleranceBp = Math.max(0.5, bpPerPx * 2)
  // Mods are stored at integer positions (left edge of base); visual center is
  // at pos+0.5, so shift the query left by 0.5 so the hit peaks at the center.
  const queryCenter = genomicPos - 0.5
  const hits = resolved.rpcData.modFlatbush.search(
    queryCenter - hitToleranceBp,
    row,
    queryCenter + hitToleranceBp,
    row,
  )
  if (hits.length === 0) {
    return undefined
  }
  const idx = hits[0]!
  const {
    modificationPositions,
    modificationColors,
    modificationTypeIndices,
    detectedModifications,
  } = resolved.rpcData
  const colorPacked = modificationColors[idx]!
  const typeIdx = modificationTypeIndices?.[idx]
  return {
    position: modificationPositions[idx]!,
    modType: typeIdx !== undefined ? detectedModifications[typeIdx] : undefined,
    // Invert the visual alpha mapping (alpha = p²+0.1) to recover raw ML prob
    probability: Math.sqrt(Math.max(0, abgrAlpha(colorPacked) / 255 - 0.1)),
    color: `rgb(${abgrRed(colorPacked)},${abgrGreen(colorPacked)},${abgrBlue(colorPacked)})`,
  }
}
