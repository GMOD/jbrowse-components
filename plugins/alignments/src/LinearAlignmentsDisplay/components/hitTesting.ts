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

import Flatbush from '@jbrowse/core/util/flatbush'

import { getInsertionRectWidthPx, getInsertionType } from '../model.ts'

import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types'

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
  rpcData: WebGLPileupDataResult
  bpRange: [number, number]
  blockStartPx: number
  blockWidth: number
  refName: string
}

export interface CigarCoords {
  bpPerPx: number
  posOffset: number
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
 * Helper: Convert canvas X coordinate to genomic position
 */
function canvasXToGenomicPosition(
  canvasX: number,
  bpRange: [number, number],
  blockStartPx: number,
  bpPerPx: number,
): number {
  return bpRange[0] + (canvasX - blockStartPx) * bpPerPx
}

/**
 * Helper: Convert canvas X coordinate to position offset within region
 */
function canvasXToPosOffset(
  canvasX: number,
  resolved: ResolvedBlock,
): { genomicPos: number; posOffset: number; bpPerPx: number } {
  const { bpRange, blockStartPx, blockWidth, rpcData } = resolved
  const bpPerPx = calculateBpPerPx(bpRange, blockWidth)
  const genomicPos = canvasXToGenomicPosition(
    canvasX,
    bpRange,
    blockStartPx,
    bpPerPx,
  )
  const posOffset = genomicPos - rpcData.regionStart
  return { genomicPos, posOffset, bpPerPx }
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
  rpcData: WebGLPileupDataResult | undefined,
) {
  if (
    !coords ||
    !rpcData?.chainFlatbushData ||
    !rpcData.chainFirstReadIndices
  ) {
    return undefined
  }

  const { adjustedY, posOffset, row } = coords
  if (adjustedY < 0) {
    return undefined
  }

  const fb = getOrCreateFlatbush(rpcData.chainFlatbushData)
  const hits = fb.search(posOffset, row, posOffset, row)
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

  const { adjustedY, yWithinRow, posOffset, row } = coords

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
    const startOffset = readPositions[i * 2]
    const endOffset = readPositions[i * 2 + 1]
    if (
      startOffset !== undefined &&
      endOffset !== undefined &&
      posOffset >= startOffset &&
      posOffset <= endOffset
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

  const { bpPerPx, posOffset, row, adjustedY, yWithinRow } = coords

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
    regionStart,
  } = blockData

  const pxPerBp = 1 / bpPerPx

  // Check large insertions first (they render as wide boxes that overlap SNPs)
  // Type 1 = insertion
  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== 1) {
      continue
    }
    const y = interbaseYs[i]
    if (y !== row) {
      continue
    }
    const pos = interbasePositions[i]
    if (pos !== undefined) {
      const len = interbaseLengths[i] ?? 0
      const type = getInsertionType(len, pxPerBp)
      if (type !== 'small') {
        const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
        const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
        if (Math.abs(posOffset - pos) < rectHalfWidthBp) {
          return {
            type: 'insertion',
            index: i,
            position: regionStart + pos,
            length: len,
            sequence: interbaseSequences[i] || undefined,
          }
        }
      }
    }
  }

  // Check mismatches (1bp features - use floor to determine which base mouse is over)
  const mouseBaseOffset = Math.floor(posOffset)
  for (let i = 0; i < numMismatches; i++) {
    const y = mismatchYs[i]
    if (y !== row) {
      continue
    }
    const pos = mismatchPositions[i]
    if (pos !== undefined && mouseBaseOffset === pos) {
      const baseCode = mismatchBases[i]!
      return {
        type: 'mismatch',
        index: i,
        position: regionStart + pos,
        base: String.fromCharCode(baseCode),
      }
    }
  }

  // Check small insertions (thin bars that don't overlap SNPs)
  // Type 1 = insertion
  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== 1) {
      continue
    }
    const y = interbaseYs[i]
    if (y !== row) {
      continue
    }
    const pos = interbasePositions[i]
    if (pos !== undefined) {
      const len = interbaseLengths[i] ?? 0
      const type = getInsertionType(len, pxPerBp)
      if (type === 'small') {
        const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
        const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
        if (Math.abs(posOffset - pos) < rectHalfWidthBp) {
          return {
            type: 'insertion',
            index: i,
            position: regionStart + pos,
            length: len,
            sequence: interbaseSequences[i] || undefined,
          }
        }
      }
    }
  }

  // Check gaps (deletions/skips - have start and end)
  const { gapTypes } = blockData
  for (let i = 0; i < numGaps; i++) {
    const y = gapYs[i]
    if (y !== row) {
      continue
    }
    const startPos = gapPositions[i * 2]
    const endPos = gapPositions[i * 2 + 1]
    if (
      startPos !== undefined &&
      endPos !== undefined &&
      posOffset >= startPos &&
      posOffset <= endPos
    ) {
      // gapTypes: 0 = deletion, 1 = skip
      const gapType = gapTypes[i]
      return {
        type: gapType === 1 ? 'skip' : 'deletion',
        index: i,
        position: regionStart + startPos,
        length: endPos - startPos,
      }
    }
  }

  // Check softclips - type 2
  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== 2) {
      continue
    }
    const y = interbaseYs[i]
    if (y !== row) {
      continue
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    // Softclips are rendered as blocks starting at their position
    if (
      pos !== undefined &&
      len !== undefined &&
      posOffset >= pos &&
      posOffset <= pos + len
    ) {
      return {
        type: 'softclip',
        index: i,
        position: regionStart + pos,
        length: len,
      }
    }
  }

  // Check hardclips - type 3
  for (let i = 0; i < numInterbases; i++) {
    if (interbaseTypes[i] !== 3) {
      continue
    }
    const y = interbaseYs[i]
    if (y !== row) {
      continue
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    // Hardclips are rendered as markers at their position
    if (pos !== undefined && Math.abs(posOffset - pos) < hitToleranceBp) {
      return {
        type: 'hardclip',
        index: i,
        position: regionStart + pos,
        length: len,
      }
    }
  }

  return undefined
}

/**
 * Binary search for the leftmost index in a sorted array where arr[index] >= value
 */
function lowerBound(arr: number[], value: number) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! < value) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Find a significant SNP offset within a bin range via binary search.
 * Returns the first match, since all positions in a bin map to the same pixel.
 */
function findSnpInBin(
  significantSnpOffsets: number[],
  binStartOffset: number,
  binEndOffset: number,
) {
  const idx = lowerBound(significantSnpOffsets, binStartOffset)
  const offset = significantSnpOffsets[idx]
  if (offset !== undefined && offset < binEndOffset) {
    return offset
  }
  return undefined
}

/**
 * Hit test for coverage area (grey bars + SNP segments)
 */
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
  const { posOffset } = canvasXToPosOffset(canvasX, resolved)

  const { coverageDepths, coverageBinSize, coverageStartOffset, regionStart } =
    blockData
  const binIndex = Math.floor(
    (posOffset - coverageStartOffset) / coverageBinSize,
  )
  if (binIndex < 0 || binIndex >= coverageDepths.length) {
    return undefined
  }

  const depth = coverageDepths[binIndex]
  if (depth === undefined || depth === 0) {
    return undefined
  }

  const binStartOffset = coverageStartOffset + binIndex * coverageBinSize
  if (coverageBinSize > 1 && blockData.significantSnpOffsets.length) {
    const binEndOffset = binStartOffset + coverageBinSize
    const snpOffset = findSnpInBin(
      blockData.significantSnpOffsets,
      binStartOffset,
      binEndOffset,
    )
    if (snpOffset !== undefined) {
      return {
        type: 'coverage',
        position: regionStart + snpOffset,
      }
    }
  }

  return {
    type: 'coverage',
    position: regionStart + binStartOffset,
  }
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
  const { posOffset, bpPerPx } = canvasXToPosOffset(canvasX, resolved)
  const hitToleranceBp = Math.max(1, bpPerPx * 5)

  const {
    indicatorPositions,
    indicatorColorTypes,
    numIndicators,
    regionStart,
  } = blockData

  for (let i = 0; i < numIndicators; i++) {
    const pos = indicatorPositions[i]
    if (pos !== undefined && Math.abs(posOffset - pos) < hitToleranceBp) {
      const colorType = indicatorColorTypes[i]
      const indicatorType = getInterbaseTypeName(colorType ?? 1)
      return {
        type: 'indicator',
        position: regionStart + pos,
        indicatorType,
      }
    }
  }

  return undefined
}

/**
 * Hit test for sashimi arcs (splice junctions overlaid on coverage)
 * Uses CPU-based Bezier curve sampling for fast hover detection
 */
export function hitTestSashimiArc(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  showCoverage: boolean,
  showSashimiArcs: boolean,
  coverageHeight: number,
): SashimiArcHitResult | undefined {
  if (
    !showCoverage ||
    !showSashimiArcs ||
    canvasY > coverageHeight ||
    !resolved
  ) {
    return undefined
  }

  const { rpcData, bpRange, blockStartPx, blockWidth, refName } = resolved
  const {
    sashimiX1,
    sashimiX2,
    sashimiCounts,
    sashimiColorTypes,
    numSashimiArcs,
    regionStart,
  } = rpcData

  if (numSashimiArcs === 0) {
    return undefined
  }

  // CPU-based Bezier curve picking (fast enough for hover)
  const pxPerBp = blockWidth / (bpRange[1] - bpRange[0])
  const bpStartOffset = bpRange[0] - regionStart

  for (let i = 0; i < numSashimiArcs; i++) {
    const x1 = sashimiX1[i]!
    const x2 = sashimiX2[i]!
    const destY = coverageHeight * (0.8 / 0.75)

    // Arc thickness from score: Math.log(count + 1)
    // Adaptive hit tolerance: easier to hover over thin arcs
    const lineWidth = rpcData.sashimiScores[i]!
    const hitTolerance = Math.max(10, lineWidth * 2.5 + 2)

    // CRITICAL: This Bezier curve formula MUST match the GPU version in:
    // shaders/arcShaders.ts:evalCurve (around line 178-190)
    // If either implementation changes, the other MUST be updated to match,
    // otherwise picking and rendering will be out of sync.
    // Sample the bezier curve for hit detection
    // Adaptive sampling based on arc width in bp
    const arcWidthBp = Math.abs(x2 - x1)
    const samplesPerBp = pxPerBp / 10 // Sample roughly every 10 pixels
    const steps = Math.max(
      16,
      Math.min(256, Math.ceil(arcWidthBp * samplesPerBp)),
    )
    let hit = false
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const mt = 1 - t
      const mt2 = mt * mt
      const mt3 = mt2 * mt
      const t2 = t * t
      const t3 = t2 * t
      const xBp = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2
      const yPx = 3 * mt2 * t * destY + 3 * mt * t2 * destY
      const screenX = blockStartPx + (xBp - bpStartOffset) * pxPerBp
      const screenY = 0.9 * coverageHeight - yPx
      const dx = canvasX - screenX
      const dy = canvasY - screenY
      const distSq = dx * dx + dy * dy
      if (distSq < hitTolerance * hitTolerance) {
        hit = true
        break
      }
    }
    if (hit) {
      const colorType = sashimiColorTypes[i]!
      const count = sashimiCounts[i]!
      return {
        start: regionStart + x1,
        end: regionStart + x2,
        score: count,
        strand: colorType === 0 ? 1 : -1,
        refName,
      }
    }
  }
  return undefined
}
