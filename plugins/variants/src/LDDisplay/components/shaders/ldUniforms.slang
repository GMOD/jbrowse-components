// Shared uniform block + helpers for both LD shader variants (genomic +
// uniform-grid). The genomic variant ignores `uniformW`; keeping the struct
// identical lets both shaders share a single UBO byte layout so the renderer
// writes one uniform buffer per frame regardless of which pass draws.
//! js-export: dprimeFinalize, ldRSquared, ldGenotypeD, ldGenotypeCorrelation, ldHaplotypeCorrelation, ldEnoughGenotypes, ldEnoughGametes, ldLociPolymorphic, ldGenotypeAlleleFreq, bandedCellCount
//! js-export-out: packages/ld-core/src/ldStats.generated.ts
//! js-skip: ldFinalize — picks one metric for the heatmap; the CPU path returns r2 AND dprime because the tooltip shows both, so it has no single value to pick. Everything ldFinalize dispatches to is exported
//! js-skip: ldGenotypeCovariance — reached as a private helper inside the generated ldGenotypeD and ldGenotypeCorrelation, so it is already shared without being public
module ldUniforms;

import diagonalGrid;

public struct Uniforms {
  public float2 canvasSize;
  public float  yScalar;
  public float  viewScale;
  public float  viewOffsetX;
  public uint   signedLd;
  public float  uniformW;
  // Pair-separation window the instance buffer was laid out at; see
  // decodeBanded. The render path needs it for the same reason the compute
  // kernels do — it is what turns a flat index back into (i, j).
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

// Sample the color ramp by `ldValue`, remapping signed [-1,1] -> [0,1] when
// signedLd is set. Returns premultiplied-alpha color.
public float4 ldRampColor(float ldValue, Uniforms u, Sampler2D<float4> ramp) {
  float t = (u.signedLd == 1u) ? (ldValue + 1.0) * 0.5 : ldValue;
  t = clamp(t, 0.0, 1.0);
  float4 c = ramp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}

// Decode flat lower-triangular instance index `idx` into (i, j) with i > j,
// where idx = i*(i-1)/2 + j. The float sqrt gives an approximate `i`; the
// correction loops fix the off-by-one that float32 rounding introduces once
// 8*idx exceeds 2^24 (~n>2000 cells). Shared with the worker compute kernels
// (ldCompute / ldPhasedCompute): they decode each cell to the same (i, j) the
// render path lays it out at, so a divergent copy would put values in the
// wrong grid cell.
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

// Map a compute thread to its banded cell, returning false for the threads past
// the last cell (which must just exit). Cells are addressed as a 2D grid
// because a 1D dispatch caps at maxComputeWorkgroupsPerDimension (65535)
// workgroups = ~4.19M cells, which a mere ~2896 SNPs exceeds. Both kernels
// decode through here so the grid addressing can't diverge between them — or
// from the render path, which lays cells out via decodeBanded.
public bool bandedCell(
  uint3 gid,
  uint dispatchRowStride,
  uint numSnps,
  uint band,
  out uint k,
  out uint2 ij
) {
  k = gid.y * dispatchRowStride + gid.x;
  if (k >= bandedCellCount(numSnps, band)) {
    ij = uint2(0u, 0u);
    return false;
  }
  ij = decodeBanded(k, band);
  return true;
}

// Final LD value from the per-cell statistics, shared by both compute kernels
// (ldCompute derives r/r2/D from per-sample covariance; ldPhasedCompute from
// haplotype-frequency popcounts, but the metric selection and D' normalization
// downstream are identical). `ldMetric == 0` returns signed r or r2; otherwise
// the composite D' (Weir 1979), clamped to [-1,1] signed or [0,1] unsigned.
// D' — D normalized by its maximum given the two allele frequencies, so a
// value is comparable across SNP pairs. Signed keeps the sign (-1..1) and
// unsigned reports magnitude (0..1). Degenerate denominators report 0 rather
// than dividing.
//
// `//! js-export`ed into @jbrowse/ld-core, whose `calculateDprime` was a
// line-for-line twin: unlike most of what this codegen covers, LD is a *number
// the user reads* off the heatmap and the tooltip, not a pixel — the WebGPU
// compute path and the CPU fallback disagreeing would be a wrong statistic, not
// a wrong-looking one. Split out of ldFinalize (which also picks the metric)
// because that half is what both sides share; `signedLD` is a bool here so the
// TS consumer passes the boolean it already has.
public float dprimeFinalize(float D, float pA, float pB, bool signedLD) {
  float qA = 1.0 - pA;
  float qB = 1.0 - pB;
  if (D > 0.0) {
    float dmax = min(pA * qB, qA * pB);
    if (dmax > 0.0) {
      return min(1.0, D / dmax);
    }
  } else if (D < 0.0) {
    float absMin = min(pA * pB, qA * qB);
    if (absMin > 0.0) {
      return signedLD ? max(-1.0, D / absMin) : min(1.0, abs(D) / absMin);
    }
  }
  return 0.0;
}

// r² from the correlation. Clamped because a composite estimator on unphased
// genotypes can overshoot 1 slightly, and because the value indexes a color
// ramp on one side and is printed in a tooltip on the other.
//
// Both kernels end here, and so do both CPU paths — four statements of one
// two-token expression, which is the shape a shared decision has just before it
// drifts.
public float ldRSquared(float r) {
  return clamp(r * r, 0.0, 1.0);
}

// The two degenerate-input gates, and the frequency they are phrased in terms
// of. Every LD path — both compute kernels and both CPU fallbacks — has to make
// these calls the same way, and until adr-051 lifted them each was written out
// where it was used: the polymorphism test in FOUR places, the dosage→frequency
// conversion in two.
//
// They are the arithmetic nobody expects to drift, which is the arithmetic
// nobody would notice drifting. Everything downstream of them was already
// generated, so a cell whose moments one side accepted and the other rejected
// was the last way the heatmap and the tooltip could disagree about a number.
// The accumulation loops above them stay per-side on purpose (a kernel walks a
// packed buffer, the CPU an Int8Array); what they produce is these moments.

// Fewest called samples a genotype cell needs. Below two there is no variance
// to correlate, so `ldGenotypeCorrelation` would divide by zero.
public bool ldEnoughGenotypes(float sampleCount) {
  return sampleCount >= 2.0;
}

// The phased counterpart, counted in gametes rather than samples: two samples'
// worth of diploid haplotypes, the same floor one step down the ploidy.
public bool ldEnoughGametes(float gameteCount) {
  return gameteCount >= 4.0;
}

// Alt-allele frequency from a dosage sum. The 2 is the ploidy — a diploid
// sample contributes up to two alt alleles — and dropping it halves every
// frequency, which D' then normalizes against and quietly changes.
public float ldGenotypeAlleleFreq(float dosageSum, float sampleCount) {
  return dosageSum / (2.0 * sampleCount);
}

// Both loci actually vary. A monomorphic locus has no linkage to report, and
// every estimator downstream divides by a variance or a frequency product that
// is zero there. Strict on both ends: a frequency of exactly 0 or 1 is fixed,
// not rare.
public bool ldLociPolymorphic(float pA, float pB) {
  return pA > 0.0 && pA < 1.0 && pB > 0.0 && pB < 1.0;
}

// Covariance of the two loci's genotype dosages, from the moments a caller
// accumulated over the called samples. Under Hardy-Weinberg Cov(g1, g2) = 2D,
// so `ldGenotypeD` halves it — the Weir (1979) composite estimator.
public float ldGenotypeCovariance(float s1, float s2, float sprod, float count) {
  return sprod / count - (s1 / count) * (s2 / count);
}

public float ldGenotypeD(float s1, float s2, float sprod, float count) {
  return ldGenotypeCovariance(s1, s2, sprod, count) * 0.5;
}

// Pearson correlation of the dosages (Rogers-Huff), the unphased r. 0 rather
// than NaN where either locus has no variance — a monomorphic locus has no
// linkage to report, and NaN would reach the color ramp as an unpainted cell on
// one backend and a clamped one on the other.
public float ldGenotypeCorrelation(
  float s1, float s2, float s1sq, float s2sq, float sprod, float count
) {
  float mean1 = s1 / count;
  float mean2 = s2 / count;
  float var1 = s1sq / count - mean1 * mean1;
  float var2 = s2sq / count - mean2 * mean2;
  if (var1 > 0.0 && var2 > 0.0) {
    return ldGenotypeCovariance(s1, s2, sprod, count) / sqrt(var1 * var2);
  }
  return 0.0;
}

// The phased counterpart: exact haplotypic r from gamete frequencies, where
// D = p11 - pA*pB is already known and the denominator is the product of the
// four allele frequencies.
public float ldHaplotypeCorrelation(float D, float pA, float pB) {
  float denom = pA * (1.0 - pA) * pB * (1.0 - pB);
  return denom > 0.0 ? D / sqrt(denom) : 0.0;
}

public float ldFinalize(
  float r, float r2, float D, float pA, float pB, uint ldMetric, uint signedLD
) {
  if (ldMetric == 0u) {
    return signedLD != 0u ? r : r2;
  }
  return dprimeFinalize(D, pA, pB, signedLD != 0u);
}
