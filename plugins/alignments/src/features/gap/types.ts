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
// It is what the two packers and the two draw functions take, and the point is
// that `gapTypes` is a `Uint8Array`: every read out of it is a `number`, so
// selecting on one is unchecked at both ends. `packGapsOfType(data, 7)` would
// otherwise compile, allocate a zero-length buffer and draw nothing — the
// silent-empty-pass failure the single `InstancePass` object exists to prevent,
// arriving through the argument instead.
export type GapTypeCode = typeof GAP_DELETION | typeof GAP_SKIP
