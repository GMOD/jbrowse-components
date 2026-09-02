// Shared uniform block + helpers for both LD shader variants (genomic +
// uniform-grid). The genomic variant ignores `uniformW`; keeping the struct
// identical lets both shaders share a single UBO byte layout so the renderer
// writes one uniform buffer per frame regardless of which pass draws.
//! js-export: ldValueComputed, bandedCellCount
//! js-export-out: packages/ld-core/src/ldStats.generated.ts
module ldUniforms;

import colorRampLut;
import diagonalGrid;

public struct Uniforms {
  public float2 canvasSize;
  public float  yScalar;
  public float  viewScale;
  public float  viewOffsetX;
  public float  uniformW;
  // Pair-separation window the instance buffer was laid out at; see
  // decodeBanded. The render path needs it for the same reason the layout does —
  // it is what turns a flat index back into (i, j).
  public uint   band;
};

// Genome-space cell corner -> clip space. Both variants lay cells out as
// 45°-rotated squares above the x-axis, so the rotation + view transform is
// identical (and shared with the Hi-C contact map via diagonalGrid); only how
// `pos` is derived differs (per-instance attribute vs. decoded grid index).
public float4 ldCellToClip(float2 pos, Uniforms u) {
  return diagonalCellToClip(
    pos, u.canvasSize, u.viewScale, u.viewOffsetX, u.yScalar);
}

// Whether a cell holds a value the LD file actually reported. Every metric
// lands in [0, 1], so -2 — `LD_NOT_COMPUTED` in @jbrowse/ld-core — is outside
// them, and `applyDisplayOrder` writes one to mark a cell no pair covered. The
// distinction is the user's, not the renderer's: an in-band cell painted at
// r² = 0 says the two variants are in linkage equilibrium, which is a
// measurement, and a pair the band skipped has no measurement to report.
//
// The test sits halfway to the sentinel rather than on the metrics' floor, so
// float error at an exact 0 cannot erase a cell.
public bool ldValueComputed(float v) {
  return v > -1.5;
}

// Sample the color ramp by `ldValue`, via the shared ramp module (render-core
// colorRampLut.slang) — the sentinel gate stays LD's own scale. Returns
// premultiplied-alpha color. A cell nothing reported is transparent, which
// under premultiplied blending leaves the background exactly as an out-of-band
// cell — never emitted — leaves it.
public float4 ldRampColor(float ldValue, Uniforms u, Sampler2D<float4> ramp) {
  if (!ldValueComputed(ldValue)) {
    return float4(0.0, 0.0, 0.0, 0.0);
  }
  return rampColorPremultiplied(ramp, ldValue);
}

// Decode flat lower-triangular instance index `idx` into (i, j) with i > j,
// where idx = i*(i-1)/2 + j. The float sqrt gives an approximate `i`; the
// correction loops fix the off-by-one that float32 rounding introduces once
// 8*idx exceeds 2^24 (~n>2000 cells).
public uint2 decodeTriangular(uint idx) {
  uint i = uint((1.0 + sqrt(1.0 + 8.0 * float(idx))) * 0.5);
  while (i * (i - 1u) / 2u > idx) { i -= 1u; }
  while ((i + 1u) * i / 2u <= idx) { i += 1u; }
  uint j = idx - i * (i - 1u) / 2u;
  return uint2(i, j);
}

// Cells stored for `numSnps` at window `band` — the TS `bandCellCount`, which
// is `bandRowStart(numSnps, band)`. Guarded at the small end because `m - 1u`
// would wrap in uint arithmetic where the TS twin merely goes negative and
// multiplies to zero.
public uint bandedCellCount(uint numSnps, uint band) {
  if (numSnps < 2u || band == 0u) {
    return 0u;
  }
  uint m = min(numSnps, band);
  return m * (m - 1u) / 2u + (numSnps - m) * band;
}

// Decode a flat BANDED index into (i, j), i > j, where row i holds only its
// j with i - j <= band. Two regimes, split at T = the head's cell count:
// rows 1..band are the untouched triangle (so an unbanded matrix, where every
// index is < T, decodes through exactly the code it always did), and rows past
// band are all exactly `band` wide, which is plain div/mod with no sqrt at all.
//
// A useful side effect of the band: the sqrt's domain is capped at T ~ band²/2
// no matter how many SNPs there are, so the float pressure that motivates
// decodeTriangular's correction loops depends on the window rather than on n.
public uint2 decodeBanded(uint idx, uint band) {
  uint T = band * (band + 1u) / 2u;
  if (idx < T) {
    return decodeTriangular(idx);
  }
  uint off = idx - T;
  uint i = band + 1u + off / band;
  return uint2(i, (i - band) + (off % band));
}
