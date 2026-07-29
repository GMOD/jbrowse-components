// Hit-test types shared across per-feature `features/X/hitTest.ts` files
// and the orchestrator in `LinearAlignmentsDisplay/hitTestPipeline.ts`.
//
// Lives in `shared/` so feature folders and `shared/clipPass.ts` don't have
// to import upward into `LinearAlignmentsDisplay/components/`.

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

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
  // Span of the op, always known: reference bases for a deletion/skip, read
  // bases for an insertion/clip, and 1 for a mismatch, which is one base by
  // construction. Required rather than optional so consumers can size the op
  // without a fallback — a hit with no length was never a real state.
  length: number
  base?: string
  sequence?: string
  // Phred base quality for a mismatch (0 = no quality reported / not applicable).
  qual?: number
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
  // Fractional position along the block, for the hit tests that measure a
  // distance to a marker (see canvasXToGenomicPos).
  genomicPos: number
  // The integer base under the cursor, for the hit tests that index one (see
  // canvasXToBasePos). Not interchangeable with flooring genomicPos — that is
  // off by one on reversed blocks.
  basePos: number
  row: number
  adjustedY: number
  yWithinRow: number
}

/**
 * Whether the cursor is on a drawn read body. Both halves matter:
 *
 * - `adjustedY >= 0` — above the pileup top the floor divide makes `row`
 *   negative. Per-row tests compare `Ys[i] !== row` so a negative row never
 *   matches, but that is accidental, and it is reachable (coverage shown with no
 *   depth under the cursor falls through to the pileup tests).
 * - `yWithinRow <= featureHeight` — `row` comes from the row PITCH (body +
 *   spacing), so without this the inter-row gap resolves to the row above.
 */
export function isWithinReadBand(coords: CigarCoords, featureHeight: number) {
  return coords.adjustedY >= 0 && coords.yWithinRow <= featureHeight
}
