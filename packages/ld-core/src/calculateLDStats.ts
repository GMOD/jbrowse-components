import { dprimeFinalize } from './dprimeFinalize.generated.ts'

// D' (normalized D) is `dprimeFinalize` from ldUniforms.slang, generated into
// TS by `pnpm gen:shaders` (adr-051), and was a line-for-line hand-written twin
// before. LD runs on WebGPU compute or on this CPU path — chosen by GPU
// availability and by a work threshold below which dispatch overhead dominates
// — so the two must agree on a *number the user reads* off the heatmap and the
// tooltip, not merely on pixels.

/**
 * Composite-LD r²/D' between two SNPs from encoded genotype dosages
 * (0=hom ref, 1=het, 2=hom alt, -1=missing). r² is the squared Pearson
 * correlation of dosages; D' uses the Weir (1979) composite estimator.
 * When `signedLD` is true, returns r (correlation) in the r2 field instead of r².
 */
export function calculateLDStats(
  geno1: Int8Array,
  geno2: Int8Array,
  signedLD = false,
): {
  r2: number
  dprime: number
} {
  let n = 0
  let sumG1 = 0
  let sumG2 = 0
  let sumG1sq = 0
  let sumG2sq = 0
  let sumProd = 0

  // Count haplotype frequencies from genotype data
  // For unphased diploid data, we estimate haplotype frequencies
  // using the composite approach
  //
  // Genotype encoding: 0=AA, 1=Aa, 2=aa (where A=ref, a=alt)
  // We count allele dosages and estimate haplotype freqs

  for (let i = 0; i < geno1.length; i++) {
    const g1 = geno1[i]!
    const g2 = geno2[i]!
    // Only include samples where both genotypes are called
    if (g1 >= 0 && g2 >= 0) {
      n++
      sumG1 += g1
      sumG2 += g2
      sumG1sq += g1 * g1
      sumG2sq += g2 * g2
      sumProd += g1 * g2
    }
  }

  // Need at least 2 samples
  if (n < 2) {
    return { r2: 0, dprime: 0 }
  }

  // Allele frequencies (frequency of alt allele)
  const pA = sumG1 / (2 * n)
  const pB = sumG2 / (2 * n)

  // If either locus is monomorphic, LD is undefined
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  // === R and R² calculation (PLINK style) ===
  // Pearson correlation of genotype dosages
  const mean1 = sumG1 / n
  const mean2 = sumG2 / n
  const var1 = sumG1sq / n - mean1 * mean1
  const var2 = sumG2sq / n - mean2 * mean2

  let r = 0
  let r2 = 0
  if (var1 > 0 && var2 > 0) {
    const cov = sumProd / n - mean1 * mean2
    r = cov / Math.sqrt(var1 * var2)
    r2 = Math.min(1, Math.max(0, r * r))
  }

  // === D' calculation ===
  // D = P(AB) - P(A)*P(B)
  // For unphased data, estimate D from genotype covariance
  // Under Hardy-Weinberg equilibrium: Cov(g1, g2) = 2D
  // So D = Cov(g1, g2) / 2 (composite LD estimator, Weir 1979)
  const covG = sumProd / n - mean1 * mean2
  const D = covG / 2

  const dprime = dprimeFinalize(D, pA, pB, signedLD)

  // For signed mode, return R instead of R²
  return { r2: signedLD ? r : r2, dprime }
}
