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
  length?: number
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
