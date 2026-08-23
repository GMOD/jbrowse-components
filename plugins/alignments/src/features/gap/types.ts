import type {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'

// Worker → main-thread payload for CIGAR gap entries (deletion + skip).
// Owned by the gap feature; consumed by packGpu / drawCanvas.
export interface GapUploadData {
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
}

// The two values a `gapTypes[i]` byte may hold. Off the generated constants
// rather than spelled `0 | 1`, so the union follows gap.slang instead of
// agreeing with it by coincidence.
//
// No production code takes one any more: the three consumers select through
// `gapMark`, which reads the byte rather than being handed one to compare
// against it. What is left is a fixture's way of saying which kind it is
// building, and the compile-time record of what the array may contain.
export type GapTypeCode = typeof GAP_DELETION | typeof GAP_SKIP
