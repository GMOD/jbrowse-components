// Worker → main-thread payload for linkedReadBezier-mode straight lines
// connecting normal-orientation pairs whose mates fall inside the same
// displayedRegion. Owned by the linkedReads feature. The worker always emits
// these (zero-length in non-chain modes) so consumers can treat the fields
// as required.
export interface LinkedReadLinesUploadData {
  linkedReadLinePositions: Uint32Array
  linkedReadLineYs: Uint16Array
  linkedReadLineColorTypes: Uint8Array
  numLinkedReadLines: number
}

export function emptyLinkedReadLinesUploadData(): LinkedReadLinesUploadData {
  return {
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}
