// Worker → main-thread payload for CIGAR mismatch entries.
// Owned by the mismatch feature; consumed by packGpu / buildRegion / drawCanvas.
export interface MismatchUploadData {
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
}
