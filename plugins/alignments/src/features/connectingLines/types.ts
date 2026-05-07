// Worker → main-thread payload for chain-mode connecting lines (straight
// horizontal lines between supplementary alignments in the same chain).
// Owned by the connectingLines feature.
export interface ConnectingLinesUploadData {
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
}
