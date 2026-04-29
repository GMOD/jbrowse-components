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
 * Modification hit testing lives in features/modification/hitTest.ts.
 *
 * All hit tests work in canvas coordinates and return genomic position data
 * for tooltip and selection purposes.
 */

import Flatbush from '@jbrowse/core/util/flatbush'

import { hitTestGap } from '../../features/gap/hitTest.ts'
import { hitTestHardclip } from '../../features/hardclip/hitTest.ts'
import {
  hitTestLargeInsertion,
  hitTestSmallInsertion,
} from '../../features/insertion/hitTest.ts'
import { hitTestMismatch } from '../../features/mismatch/hitTest.ts'
import { hitTestSoftclip } from '../../features/softclip/hitTest.ts'

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

export type { CoverageHitResult } from '../../features/coverage/types.ts'

export type {
  IndicatorHitResult,
  InterbaseType,
} from '../../features/indicator/types.ts'
export { INTERBASE_TYPES } from '../../features/indicator/types.ts'

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

  const { readPositions, readYs, readIds } = resolved.rpcData
  const numReads = readIds.length

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

  const { adjustedY, yWithinRow } = coords

  if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
    return undefined
  }

  // Priority order, top-down:
  //  1. large insertions (wide boxes that overlap SNPs)
  //  2. mismatches (1bp features under the cursor base)
  //  3. small insertions (thin bars that don't overlap SNPs)
  //  4. gaps (deletions/skips spanning the read body)
  //  5. softclips, then hardclips (interbase bars at alignment edges)
  return (
    hitTestLargeInsertion(resolved, coords) ??
    hitTestMismatch(resolved, coords) ??
    hitTestSmallInsertion(resolved, coords) ??
    hitTestGap(resolved, coords) ??
    hitTestSoftclip(resolved, coords) ??
    hitTestHardclip(resolved, coords)
  )
}

export { hitTestCoverage } from '../../features/coverage/hitTest.ts'
export { hitTestIndicator } from '../../features/indicator/hitTest.ts'

