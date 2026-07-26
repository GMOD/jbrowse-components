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
  genomicPos: number
  row: number
  adjustedY: number
  yWithinRow: number
}
