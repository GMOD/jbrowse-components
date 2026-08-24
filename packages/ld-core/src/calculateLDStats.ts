import {
  dprimeFinalize,
  ldEnoughGenotypes,
  ldGenotypeAlleleFreq,
  ldGenotypeCorrelation,
  ldGenotypeD,
  ldLociPolymorphic,
  ldRSquared,
} from './ldStats.generated.ts'

// Every statistic below comes from ldUniforms.slang, generated into TS by
// `pnpm gen:shaders` (adr-051); each was a line-for-line hand-written twin
// before. LD runs on WebGPU compute (`ldCompute.slang`) or on a CPU path —
// chosen by GPU availability and by a work threshold below which dispatch
// overhead dominates — so the two must agree on a *number the user reads* off
// the heatmap and the tooltip, not merely on pixels.
//
// The CPU path the app runs is `calculateLDStatsDosageBits`, which reaches the
// same six moments by popcount over bit planes. This function is the scalar
// statement of them — one sample per iteration, nothing packed — which is what
// makes it the thing the packed kernel is checked against, at exact equality
// rather than a tolerance (`calculateLDStatsDosage.test.ts`). It is meant to
// stay readable, not to be fast.

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

  if (!ldEnoughGenotypes(n)) {
    return { r2: 0, dprime: 0 }
  }

  const pA = ldGenotypeAlleleFreq(sumG1, n)
  const pB = ldGenotypeAlleleFreq(sumG2, n)

  if (!ldLociPolymorphic(pA, pB)) {
    return { r2: 0, dprime: 0 }
  }

  // r is the Pearson correlation of the dosages (Rogers-Huff, what PLINK's
  // --r2 reports); D is Cov(g1, g2) / 2, the Weir (1979) composite estimator,
  // which holds under Hardy-Weinberg.
  const r = ldGenotypeCorrelation(sumG1, sumG2, sumG1sq, sumG2sq, sumProd, n)
  const dprime = dprimeFinalize(
    ldGenotypeD(sumG1, sumG2, sumProd, n),
    pA,
    pB,
    signedLD,
  )

  // For signed mode, return R instead of R²
  return { r2: signedLD ? r : ldRSquared(r), dprime }
}
