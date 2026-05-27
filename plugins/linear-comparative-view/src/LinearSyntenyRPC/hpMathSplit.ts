// Non-allocating variant of `splitPositionWithFrac` from
// `@jbrowse/core/gpu/blockClipUtils`. Writes the hi/lo Float32 pair for a
// Float64 cumulative-bp value directly into typed arrays at `idx`. Used in
// the per-instance emit loop in buildSyntenyGeometry — the tuple-returning
// shared helper would create one array per call (4 per addInstance), which
// adds measurable GC pressure across millions of CIGAR segments.
//
// Invariants:
//   - hi is a multiple of 4096 representable exactly in Float32 for any
//     cumulative-bp value up to ~2^31 (4 Gbp cap)
//   - lo is in [0, 4096) and carries the fractional remainder
//   - hi + lo === cumBp in Float64 (within Float64 ULP)
//
// SYNC: matches `splitPositionWithFrac` in
// packages/core/src/gpu/blockClipUtils.ts and `splitPositionWithFrac` in
// shaders/hpmath.slang.
export function writeHiLo(
  cumBp: number,
  hiArr: Float32Array,
  loArr: Float32Array,
  idx: number,
) {
  const iv = Math.floor(cumBp)
  const lo = iv - Math.floor(iv / 4096) * 4096
  hiArr[idx] = iv - lo
  loArr[idx] = lo + (cumBp - iv)
}
