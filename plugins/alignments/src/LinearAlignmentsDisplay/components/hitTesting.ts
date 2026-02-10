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
  position: number // genomic position
  depth: number
  snps: { base: string; count: number }[] // SNP counts at this position
}

// Types for indicator hit testing
export interface IndicatorHitResult {
  type: 'indicator'
  position: number // genomic position
  indicatorType: 'insertion' | 'softclip' | 'hardclip'
  counts: { insertion: number; softclip: number; hardclip: number }
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
function calculateBpPerPx(bpRange: [number, number], blockWidth: number): number {
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
  const genomicPos = canvasXToGenomicPosition(canvasX, bpRange, blockStartPx, bpPerPx)
  const posOffset = genomicPos - rpcData.regionStart
  return { genomicPos, posOffset, bpPerPx }
}

/**
 * Helper: Map interbase color type (1-3) to type name
 */
function getInterbaseTypeName(colorType: number): InterbaseType {
  return INTERBASE_TYPES[(colorType - 1) % 3] ?? 'insertion'
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

  if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
    return undefined
  }

  const { readPositions, readYs, readIds, numReads } = resolved.rpcData
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
    insertionPositions,
    insertionYs,
    insertionLengths,
    insertionSequences,
    numInsertions,
    gapPositions,
    gapYs,
    numGaps,
    softclipPositions,
    softclipYs,
    softclipLengths,
    numSoftclips,
    hardclipPositions,
    hardclipYs,
    hardclipLengths,
    numHardclips,
    regionStart,
  } = blockData

  // Check mismatches first (they're visually prominent)
  // Mismatches are 1bp features - use floor to determine which base mouse is over
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

  // Check insertions (rendered as markers at interbase positions)
  // Large insertions (>=10bp) are rendered as wider rectangles when zoomed in
  for (let i = 0; i < numInsertions; i++) {
    const y = insertionYs[i]
    if (y !== row) {
      continue
    }
    const pos = insertionPositions[i]
    if (pos !== undefined) {
      const len = insertionLengths[i] ?? 0
      const pxPerBp = 1 / bpPerPx
      // Get visual width from helper, add 2px buffer for easier clicking
      const { getInsertionRectWidthPx } = require('../model')
      const rectWidthPx = getInsertionRectWidthPx(len, pxPerBp) + 4
      const rectHalfWidthBp = (rectWidthPx / 2) * bpPerPx
      if (Math.abs(posOffset - pos) < rectHalfWidthBp) {
        return {
          type: 'insertion',
          index: i,
          position: regionStart + pos,
          length: len,
          sequence: insertionSequences[i] || undefined,
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

  // Check softclips
  for (let i = 0; i < numSoftclips; i++) {
    const y = softclipYs[i]
    if (y !== row) {
      continue
    }
    const pos = softclipPositions[i]
    const len = softclipLengths[i]
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

  // Check hardclips
  for (let i = 0; i < numHardclips; i++) {
    const y = hardclipYs[i]
    if (y !== row) {
      continue
    }
    const pos = hardclipPositions[i]
    const len = hardclipLengths[i]
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

  const {
    coverageDepths,
    coverageBinSize,
    coverageStartOffset,
    coverageMaxDepth,
    regionStart,
  } = blockData
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

  // Collect SNPs at this position
  const snps: { base: string; count: number }[] = []
  const baseNames = ['A', 'C', 'G', 'T']
  const snpCounts: Record<string, number> = { A: 0, C: 0, G: 0, T: 0 }

  // Look for SNP segments at this position
  const {
    snpPositions,
    snpHeights,
    snpColorTypes,
    numSnpSegments,
    noncovPositions,
    noncovHeights,
    noncovColorTypes,
    numNoncovSegments,
  } = blockData

  // Integer position for exact matching
  const intPosOffset = Math.floor(posOffset)

  for (let i = 0; i < numSnpSegments; i++) {
    const snpPos = snpPositions[i]
    if (snpPos === intPosOffset) {
      const colorType = snpColorTypes[i]
      const height = snpHeights[i]
      if (
        colorType !== undefined &&
        height !== undefined &&
        colorType >= 1 &&
        colorType <= 4
      ) {
        const baseName = baseNames[colorType - 1]!
        // Convert normalized height back to count
        const count = Math.round(height * coverageMaxDepth)
        snpCounts[baseName]! += count
      }
    }
  }

  for (const [base, count] of Object.entries(snpCounts)) {
    if (count > 0) {
      snps.push({ base, count })
    }
  }

  // Also collect noncov (interbase) data at this position
  const noncovCounts: Record<string, number> = {
    insertion: 0,
    softclip: 0,
    hardclip: 0,
  }

  for (let i = 0; i < numNoncovSegments; i++) {
    const noncovPos = noncovPositions[i]
    if (noncovPos === intPosOffset) {
      const colorType = noncovColorTypes[i]
      const height = noncovHeights[i]
      if (
        colorType !== undefined &&
        height !== undefined &&
        colorType >= 1 &&
        colorType <= 3
      ) {
        const typeName = getInterbaseTypeName(colorType)
        // Convert normalized height back to count using noncovMaxCount
        const count = Math.round(height * blockData.noncovMaxCount)
        noncovCounts[typeName] += count
      }
    }
  }

  // Add noncov items to snps array with different formatting
  for (const [type, count] of Object.entries(noncovCounts)) {
    if (count > 0) {
      snps.push({ base: type, count })
    }
  }

  return {
    type: 'coverage',
    position:
      regionStart + coverageStartOffset + binIndex * coverageBinSize,
    depth,
    snps,
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
  if (
    !showCoverage ||
    !showInterbaseIndicators ||
    canvasY > 5 ||
    !resolved
  ) {
    return undefined
  }

  const blockData = resolved.rpcData
  const { posOffset, bpPerPx } = canvasXToPosOffset(canvasX, resolved)
  const hitToleranceBp = Math.max(1, bpPerPx * 5)

  const {
    indicatorPositions,
    indicatorColorTypes,
    numIndicators,
    noncovPositions,
    noncovHeights,
    noncovColorTypes,
    numNoncovSegments,
    regionStart,
  } = blockData

  for (let i = 0; i < numIndicators; i++) {
    const pos = indicatorPositions[i]
    if (pos !== undefined && Math.abs(posOffset - pos) < hitToleranceBp) {
      const colorType = indicatorColorTypes[i]
      const indicatorType = getInterbaseTypeName(colorType ?? 1)

      // Collect counts for all interbase types at this position
      const counts = { insertion: 0, softclip: 0, hardclip: 0 }

      for (let j = 0; j < numNoncovSegments; j++) {
        const noncovPos = noncovPositions[j]
        if (noncovPos === pos) {
          const noncovColorType = noncovColorTypes[j]
          const height = noncovHeights[j]
          if (
            noncovColorType !== undefined &&
            height !== undefined &&
            noncovColorType >= 1 &&
            noncovColorType <= 3
          ) {
            const typeName = getInterbaseTypeName(noncovColorType)
            const count = Math.round(height * blockData.noncovMaxCount)
            counts[typeName] += count
          }
        }
      }

      return {
        type: 'indicator',
        position: regionStart + pos,
        indicatorType,
        counts,
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
    const steps = Math.max(16, Math.min(256, Math.ceil(arcWidthBp * samplesPerBp)))
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
