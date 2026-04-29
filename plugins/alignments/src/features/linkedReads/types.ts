// Worker → main-thread payload for linkedReadBezier-mode straight lines
// connecting normal-orientation pairs whose mates fall inside the same
// displayedRegion. Owned by the linkedReads feature.
export interface LinkedReadLinesUploadData {
  linkedReadLinePositions?: Uint32Array
  linkedReadLineYs?: Uint16Array
  linkedReadLineColorTypes?: Uint8Array
  numLinkedReadLines?: number
}
