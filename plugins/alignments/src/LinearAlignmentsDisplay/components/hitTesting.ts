/**
 * Hit-test types + the two read-level hit tests that don't have their own
 * feature folder (whole-read and chain bounding box). Per-feature CIGAR /
 * coverage / indicator / modification hit tests live in
 * features/X/hitTest.ts and are composed by `hitTestPipeline.ts`.
 */

import Flatbush from '@jbrowse/core/util/flatbush'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types'

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
  position: number
  length?: number
  base?: string
  sequence?: string
}

export interface SashimiArcHitResult {
  start: number
  end: number
  score: number
  strand: number
  refName: string
}

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
