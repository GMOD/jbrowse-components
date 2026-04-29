// Worker → main-thread payload for CIGAR gap entries (deletion + skip).
// Owned by the gap feature; consumed by packGpu / buildRegion / drawCanvas.
export interface GapUploadData {
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
}
