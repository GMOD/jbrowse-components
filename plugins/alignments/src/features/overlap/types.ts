// Main-thread payload for chain-mode read overlaps: genomic intervals where two
// reads in the same chain (and thus the same row) overlap. Drawn as a mild
// semi-transparent dark tint. Owned by the overlap feature. Computed in
// computeChainLayout.
export interface OverlapsUploadData {
  overlapPositions: Uint32Array // [start, end] absolute genomic uint32 pairs
  overlapYs: Uint16Array // shared chain row for each overlap
}

export function emptyOverlapsUploadData(): OverlapsUploadData {
  return {
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
  }
}
