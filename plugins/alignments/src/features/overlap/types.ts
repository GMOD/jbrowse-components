import {
  OVERLAP_MATES,
  OVERLAP_SEGMENTS,
} from '../../shaders/slang/overlap.consts.generated.ts'

// Main-thread payload for read overlaps: genomic intervals where two features
// that share a row both align. Owned by the overlap feature; computed in
// computeChainLayout (two segments of one molecule, merged) or collapsedLayout
// (unrelated reads, deliberately not merged so the mark can stack). What each
// form is DRAWN as is overlap.slang's branch, and the difference is the reason
// the merge differs.
export interface OverlapsUploadData {
  overlapPositions: Uint32Array // [start, end] absolute genomic uint32 pairs
  overlapYs: Uint16Array // shared chain row for each overlap
  overlapKinds: Uint8Array // OVERLAP_SEGMENTS or OVERLAP_MATES (overlap.slang)
}

export function emptyOverlapsUploadData(): OverlapsUploadData {
  return {
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
    overlapKinds: new Uint8Array(0),
  }
}

// A per-kind table indexed by `overlapKinds`, the key both painters and the
// tables export read.
export function byOverlapKind<T>(segments: T, mates: T) {
  const table: T[] = []
  table[OVERLAP_SEGMENTS] = segments
  table[OVERLAP_MATES] = mates
  return table
}
