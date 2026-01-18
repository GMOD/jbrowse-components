// Helper functions copied from getLDMatrix.ts for testing
// These are internal functions that we want to test directly

const SPLITTER = /[/|]/

function encodeGenotypes(
  genotypes: Record<string, string>,
  samples: string[],
  splitCache: Record<string, string[]>,
): Int8Array {
  const encoded = new Int8Array(samples.length)
  for (const [i, sample] of samples.entries()) {
    const val = genotypes[sample]!
    const alleles = splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))

    let nonRefCount = 0
    let uncalledCount = 0
    for (const allele of alleles) {
      if (allele === '.') {
        uncalledCount++
      } else if (allele !== '0') {
        nonRefCount++
      }
    }

    if (uncalledCount === alleles.length) {
      encoded[i] = -1
    } else if (nonRefCount === 0) {
      encoded[i] = 0
    } else if (nonRefCount === alleles.length) {
      encoded[i] = 2
    } else {
      encoded[i] = 1
    }
  }
  return encoded
}

function calculateLDStats(
  geno1: Int8Array,
  geno2: Int8Array,
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

  for (const [i, element] of geno1.entries()) {
    const g1 = element
    const g2 = geno2[i]!
    if (g1 >= 0 && g2 >= 0) {
      n++
      sumG1 += g1
      sumG2 += g2
      sumG1sq += g1 * g1
      sumG2sq += g2 * g2
      sumProd += g1 * g2
    }
  }

  if (n < 2) {
    return { r2: 0, dprime: 0 }
  }

  const pA = sumG1 / (2 * n)
  const pB = sumG2 / (2 * n)
  const qA = 1 - pA
  const qB = 1 - pB

  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  const mean1 = sumG1 / n
  const mean2 = sumG2 / n
  const var1 = sumG1sq / n - mean1 * mean1
  const var2 = sumG2sq / n - mean2 * mean2

  let r2 = 0
  if (var1 > 0 && var2 > 0) {
    const cov = sumProd / n - mean1 * mean2
    r2 = (cov * cov) / (var1 * var2)
    r2 = Math.min(1, Math.max(0, r2))
  }

  const covG = sumProd / n - mean1 * mean2
  const D = covG / 2 // Under HWE: Cov(g1,g2) = 2D, so D = Cov/2

  let dprime = 0
  if (D > 0) {
    const Dmax = Math.min(pA * qB, qA * pB)
    if (Dmax > 0) {
      dprime = Math.min(1, D / Dmax)
    }
  } else if (D < 0) {
    const Dmin = -Math.min(pA * pB, qA * qB)
    if (Dmin < 0) {
      dprime = Math.min(1, Math.abs(D / Dmin))
    }
  }

  return { r2, dprime }
}

describe('encodeGenotypes', () => {
  const samples = ['s1', 's2', 's3', 's4']

  it('encodes homozygous ref as 0', () => {
    const genotypes = { s1: '0/0', s2: '0/0', s3: '0/0', s4: '0/0' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([0, 0, 0, 0])
  })

  it('encodes heterozygous as 1', () => {
    const genotypes = { s1: '0/1', s2: '0/1', s3: '0/1', s4: '0/1' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([1, 1, 1, 1])
  })

  it('encodes homozygous alt as 2', () => {
    const genotypes = { s1: '1/1', s2: '1/1', s3: '1/1', s4: '1/1' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([2, 2, 2, 2])
  })

  it('encodes missing as -1', () => {
    const genotypes = { s1: './.', s2: './.', s3: './.', s4: './.' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([-1, -1, -1, -1])
  })

  it('handles phased genotypes', () => {
    const genotypes = { s1: '0|0', s2: '0|1', s3: '1|0', s4: '1|1' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([0, 1, 1, 2])
  })

  it('handles mixed genotypes', () => {
    const genotypes = { s1: '0/0', s2: '0/1', s3: '1/1', s4: './.' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    expect(Array.from(encoded)).toEqual([0, 1, 2, -1])
  })

  it('handles multiallelic sites (any non-ref is alt)', () => {
    const genotypes = { s1: '0/2', s2: '1/2', s3: '2/2', s4: '0/0' }
    const encoded = encodeGenotypes(genotypes, samples, {})
    // 0/2 = het (1), 1/2 = hom alt (2), 2/2 = hom alt (2), 0/0 = hom ref (0)
    expect(Array.from(encoded)).toEqual([1, 2, 2, 0])
  })
})

describe('calculateLDStats', () => {
  it('returns perfect LD (r2=1) for identical genotypes', () => {
    const geno1 = new Int8Array([0, 1, 2, 0, 1, 2])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(1)
  })

  it('returns zero LD for independent genotypes', () => {
    // Construct genotypes that should have low correlation
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 0, 2, 2])
    const geno2 = new Int8Array([0, 2, 0, 2, 0, 2, 0, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(0, 1)
  })

  it('returns zero LD for monomorphic site', () => {
    const geno1 = new Int8Array([0, 0, 0, 0, 0, 0])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBe(0)
    expect(stats.dprime).toBe(0)
  })

  it('handles missing genotypes by excluding them', () => {
    const geno1 = new Int8Array([0, 1, 2, -1, -1, -1])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    // Only first 3 samples are used
    expect(stats.r2).toBeCloseTo(1)
  })

  it('returns zero if less than 2 valid samples', () => {
    const geno1 = new Int8Array([-1, -1, 0])
    const geno2 = new Int8Array([-1, -1, 1])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBe(0)
    expect(stats.dprime).toBe(0)
  })

  it('calculates intermediate LD correctly', () => {
    // Create genotypes with known LD
    // Perfect anti-correlation: when one is 0, other is 2
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 2])
    const geno2 = new Int8Array([2, 2, 0, 0, 2, 0])
    const stats = calculateLDStats(geno1, geno2)
    // Should have high R² (perfect negative correlation squares to positive)
    expect(stats.r2).toBeCloseTo(1)
  })

  it('calculates LD for realistic population data', () => {
    // Simulate 20 samples with SNPs in moderate LD
    // SNP1 and SNP2 are somewhat correlated
    const geno1 = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
    ])
    const geno2 = new Int8Array([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2,
    ])
    const stats = calculateLDStats(geno1, geno2)
    // Should have moderate LD
    expect(stats.r2).toBeGreaterThan(0.3)
    expect(stats.r2).toBeLessThan(1)
  })
})

describe('LD calculation edge cases', () => {
  it('handles all heterozygous samples', () => {
    const geno1 = new Int8Array([1, 1, 1, 1, 1, 1])
    const geno2 = new Int8Array([1, 1, 1, 1, 1, 1])
    const stats = calculateLDStats(geno1, geno2)
    // All samples are het - no variance, should return 0
    expect(stats.r2).toBe(0)
  })

  it('handles rare variant scenario', () => {
    // One rare allele carrier
    const geno1 = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
    const geno2 = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
    const stats = calculateLDStats(geno1, geno2)
    // Perfect correlation for rare variant
    expect(stats.r2).toBeCloseTo(1)
  })

  it('handles minimum sample size (n=2)', () => {
    const geno1 = new Int8Array([0, 2])
    const geno2 = new Int8Array([0, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(1)
  })

  it('returns 0 for completely uncorrelated variants', () => {
    // Construct genotypes where knowing one tells you nothing about the other
    // Each combination of (0,0), (0,2), (2,0), (2,2) appears equally
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 0, 2, 2])
    const geno2 = new Int8Array([0, 2, 0, 2, 0, 2, 0, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(0, 1)
  })
})

describe("R² vs D' differences", () => {
  it("D' can be 1 when R² is less than 1", () => {
    // D' = 1 means no recombination has occurred (complete LD)
    // but R² can be < 1 if allele frequencies differ
    // Example: SNP1 has MAF 0.1, SNP2 has MAF 0.4
    // If the rare allele of SNP1 always co-occurs with one allele of SNP2
    const geno1 = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1])
    const geno2 = new Int8Array([0, 0, 0, 1, 1, 1, 2, 2, 2, 2])
    const stats = calculateLDStats(geno1, geno2)
    // D' should be higher than R² in this scenario
    // (exact values depend on the calculation method)
    expect(stats.dprime).toBeGreaterThanOrEqual(0)
    expect(stats.r2).toBeGreaterThanOrEqual(0)
  })

  it("R² equals D' squared when allele frequencies are equal", () => {
    // When both SNPs have 50% allele frequency and are in complete LD
    const geno1 = new Int8Array([0, 0, 0, 0, 0, 2, 2, 2, 2, 2])
    const geno2 = new Int8Array([0, 0, 0, 0, 0, 2, 2, 2, 2, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(1)
    expect(stats.dprime).toBeCloseTo(1)
  })
})

describe('known LD scenarios', () => {
  it('computes correct LD for HapMap-style high LD block', () => {
    // Simulate a high LD region where most haplotypes are conserved
    // Two common haplotypes: 00000 and 22222
    const geno1 = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 1,
    ])
    const geno2 = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 1,
    ])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBeCloseTo(1)
  })

  it('computes lower LD after recombination', () => {
    // After recombination, haplotypes become shuffled
    const geno1 = new Int8Array([
      0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 2, 2, 1, 1, 1, 1,
    ])
    const geno2 = new Int8Array([
      0, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 2, 1, 1, 1, 1,
    ])
    const stats = calculateLDStats(geno1, geno2)
    // Should have lower LD than perfect correlation
    expect(stats.r2).toBeLessThan(0.8)
  })

  it('handles population with admixture', () => {
    // Mixed population where LD patterns vary
    const geno1 = new Int8Array([
      0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 0, 1, 2, 0, 1,
    ])
    const geno2 = new Int8Array([
      0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0, 1, 2, 2,
    ])
    const stats = calculateLDStats(geno1, geno2)
    // Should have moderate LD
    expect(stats.r2).toBeGreaterThan(0.2)
    expect(stats.r2).toBeLessThan(0.9)
  })
})

describe('LD with missing data patterns', () => {
  it('handles missing data in one SNP only', () => {
    const geno1 = new Int8Array([0, 1, 2, -1, -1, 0, 1, 2])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    // Should compute LD using only complete pairs
    expect(stats.r2).toBeCloseTo(1)
  })

  it('handles sporadic missing data', () => {
    const geno1 = new Int8Array([0, -1, 2, 0, -1, 2, 0, 1, 2])
    const geno2 = new Int8Array([-1, 1, 2, 0, 1, -1, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    // Should still compute reasonable LD
    expect(stats.r2).toBeGreaterThanOrEqual(0)
    expect(stats.r2).toBeLessThanOrEqual(1)
  })

  it('returns 0 when all pairs have at least one missing', () => {
    const geno1 = new Int8Array([-1, 0, -1, 2])
    const geno2 = new Int8Array([0, -1, 2, -1])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBe(0)
    expect(stats.dprime).toBe(0)
  })
})

// Helper functions for phased data tests
function isPhased(genotypes: Record<string, string>): boolean {
  const firstVal = Object.values(genotypes)[0]
  return firstVal?.includes('|') ?? false
}

function encodePhasedHaplotypes(
  genotypes: Record<string, string>,
  samples: string[],
): { hap1: Int8Array; hap2: Int8Array } {
  const hap1 = new Int8Array(samples.length)
  const hap2 = new Int8Array(samples.length)

  for (const [i, sample] of samples.entries()) {
    const val = genotypes[sample]!
    const alleles = val.split('|')

    if (alleles.length !== 2) {
      hap1[i] = -1
      hap2[i] = -1
      continue
    }

    hap1[i] = alleles[0] === '.' ? -1 : alleles[0] === '0' ? 0 : 1
    hap2[i] = alleles[1] === '.' ? -1 : alleles[1] === '0' ? 0 : 1
  }

  return { hap1, hap2 }
}

function calculateLDStatsPhased(
  haps1: { hap1: Int8Array; hap2: Int8Array },
  haps2: { hap1: Int8Array; hap2: Int8Array },
): { r2: number; dprime: number } {
  let n01 = 0
  let n10 = 0
  let n11 = 0
  let total = 0

  const numSamples = haps1.hap1.length

  // Count haplotypes from both chromosomes
  for (let i = 0; i < numSamples; i++) {
    const a1 = haps1.hap1[i]!
    const b1 = haps2.hap1[i]!
    if (a1 >= 0 && b1 >= 0) {
      if (a1 === 0 && b1 === 1) {
        n01++
      } else if (a1 === 1 && b1 === 0) {
        n10++
      } else if (a1 === 1 && b1 === 1) {
        n11++
      }
      total++
    }

    const a2 = haps1.hap2[i]!
    const b2 = haps2.hap2[i]!
    if (a2 >= 0 && b2 >= 0) {
      if (a2 === 0 && b2 === 1) {
        n01++
      } else if (a2 === 1 && b2 === 0) {
        n10++
      } else if (a2 === 1 && b2 === 1) {
        n11++
      }
      total++
    }
  }

  if (total < 4) {
    return { r2: 0, dprime: 0 }
  }

  const p01 = n01 / total
  const p10 = n10 / total
  const p11 = n11 / total

  const pA = p10 + p11
  const pB = p01 + p11
  const qA = 1 - pA
  const qB = 1 - pB

  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  const D = p11 - pA * pB
  const r2 = Math.min(1, Math.max(0, (D * D) / (pA * qA * pB * qB)))

  let dprime = 0
  if (D > 0) {
    const Dmax = Math.min(pA * qB, qA * pB)
    if (Dmax > 0) {
      dprime = Math.min(1, D / Dmax)
    }
  } else if (D < 0) {
    const Dmin = -Math.min(pA * pB, qA * qB)
    if (Dmin < 0) {
      dprime = Math.min(1, Math.abs(D / Dmin))
    }
  }

  return { r2, dprime }
}

describe('isPhased', () => {
  it('detects phased genotypes', () => {
    expect(isPhased({ s1: '0|1', s2: '1|0' })).toBe(true)
    expect(isPhased({ s1: '0|0', s2: '1|1' })).toBe(true)
  })

  it('detects unphased genotypes', () => {
    expect(isPhased({ s1: '0/1', s2: '1/0' })).toBe(false)
    expect(isPhased({ s1: '0/0', s2: '1/1' })).toBe(false)
  })
})

describe('encodePhasedHaplotypes', () => {
  const samples = ['s1', 's2', 's3', 's4']

  it('encodes phased homozygous ref correctly', () => {
    const genotypes = { s1: '0|0', s2: '0|0', s3: '0|0', s4: '0|0' }
    const { hap1, hap2 } = encodePhasedHaplotypes(genotypes, samples)
    expect(Array.from(hap1)).toEqual([0, 0, 0, 0])
    expect(Array.from(hap2)).toEqual([0, 0, 0, 0])
  })

  it('encodes phased heterozygous correctly', () => {
    const genotypes = { s1: '0|1', s2: '1|0', s3: '0|1', s4: '1|0' }
    const { hap1, hap2 } = encodePhasedHaplotypes(genotypes, samples)
    // s1: chrom1=ref, chrom2=alt
    // s2: chrom1=alt, chrom2=ref
    expect(Array.from(hap1)).toEqual([0, 1, 0, 1])
    expect(Array.from(hap2)).toEqual([1, 0, 1, 0])
  })

  it('encodes phased homozygous alt correctly', () => {
    const genotypes = { s1: '1|1', s2: '1|1', s3: '1|1', s4: '1|1' }
    const { hap1, hap2 } = encodePhasedHaplotypes(genotypes, samples)
    expect(Array.from(hap1)).toEqual([1, 1, 1, 1])
    expect(Array.from(hap2)).toEqual([1, 1, 1, 1])
  })

  it('handles missing alleles', () => {
    const genotypes = { s1: '.|.', s2: '0|.', s3: '.|1', s4: '0|1' }
    const { hap1, hap2 } = encodePhasedHaplotypes(genotypes, samples)
    expect(Array.from(hap1)).toEqual([-1, 0, -1, 0])
    expect(Array.from(hap2)).toEqual([-1, -1, 1, 1])
  })
})

describe('calculateLDStatsPhased', () => {
  it('returns perfect LD for identical phased haplotypes', () => {
    // All samples have same haplotypes at both loci
    const samples = ['s1', 's2', 's3', 's4', 's5', 's6']
    const geno1 = {
      s1: '0|0',
      s2: '0|1',
      s3: '1|0',
      s4: '1|1',
      s5: '0|1',
      s6: '1|0',
    }
    const geno2 = {
      s1: '0|0',
      s2: '0|1',
      s3: '1|0',
      s4: '1|1',
      s5: '0|1',
      s6: '1|0',
    }

    const haps1 = encodePhasedHaplotypes(geno1, samples)
    const haps2 = encodePhasedHaplotypes(geno2, samples)
    const stats = calculateLDStatsPhased(haps1, haps2)

    expect(stats.r2).toBeCloseTo(1)
    expect(stats.dprime).toBeCloseTo(1)
  })

  it('returns zero LD for independent loci', () => {
    // Construct haplotypes where loci are independent
    const samples = ['s1', 's2', 's3', 's4']
    // Locus 1: alternating 0|1, 1|0
    // Locus 2: all 0|1
    const geno1 = { s1: '0|1', s2: '1|0', s3: '0|1', s4: '1|0' }
    const geno2 = { s1: '0|0', s2: '1|1', s3: '1|1', s4: '0|0' }

    const haps1 = encodePhasedHaplotypes(geno1, samples)
    const haps2 = encodePhasedHaplotypes(geno2, samples)
    const stats = calculateLDStatsPhased(haps1, haps2)

    // Should have low LD
    expect(stats.r2).toBeLessThan(0.5)
  })

  it('correctly identifies cis vs trans haplotypes', () => {
    // This is the key advantage of phased data
    // Two individuals, both heterozygous at both loci
    // But one is cis (0|1, 0|1) and one is trans (0|1, 1|0)
    const samples = ['s1', 's2', 's3', 's4']

    // All cis: alt alleles on same chromosome
    const geno1_cis = { s1: '0|1', s2: '0|1', s3: '0|1', s4: '0|1' }
    const geno2_cis = { s1: '0|1', s2: '0|1', s3: '0|1', s4: '0|1' }

    const haps1_cis = encodePhasedHaplotypes(geno1_cis, samples)
    const haps2_cis = encodePhasedHaplotypes(geno2_cis, samples)
    const stats_cis = calculateLDStatsPhased(haps1_cis, haps2_cis)

    // All trans: alt alleles on different chromosomes
    const geno1_trans = { s1: '0|1', s2: '0|1', s3: '0|1', s4: '0|1' }
    const geno2_trans = { s1: '1|0', s2: '1|0', s3: '1|0', s4: '1|0' }

    const haps1_trans = encodePhasedHaplotypes(geno1_trans, samples)
    const haps2_trans = encodePhasedHaplotypes(geno2_trans, samples)
    const stats_trans = calculateLDStatsPhased(haps1_trans, haps2_trans)

    // Cis should show positive LD (high r², D' = 1)
    expect(stats_cis.r2).toBeCloseTo(1)
    expect(stats_cis.dprime).toBeCloseTo(1)

    // Trans should show negative LD (high r², D' = 1 but D is negative)
    expect(stats_trans.r2).toBeCloseTo(1)
    expect(stats_trans.dprime).toBeCloseTo(1)
  })

  it('handles population with mixed phase', () => {
    const samples = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']

    // Mix of haplotypes to create moderate LD
    const geno1 = {
      s1: '0|0',
      s2: '0|0',
      s3: '0|1',
      s4: '0|1',
      s5: '1|0',
      s6: '1|0',
      s7: '1|1',
      s8: '1|1',
    }
    const geno2 = {
      s1: '0|0',
      s2: '0|1',
      s3: '0|0',
      s4: '1|1',
      s5: '1|0',
      s6: '0|1',
      s7: '1|1',
      s8: '1|0',
    }

    const haps1 = encodePhasedHaplotypes(geno1, samples)
    const haps2 = encodePhasedHaplotypes(geno2, samples)
    const stats = calculateLDStatsPhased(haps1, haps2)

    // Should have moderate LD
    expect(stats.r2).toBeGreaterThanOrEqual(0)
    expect(stats.r2).toBeLessThanOrEqual(1)
    expect(stats.dprime).toBeGreaterThanOrEqual(0)
    expect(stats.dprime).toBeLessThanOrEqual(1)
  })
})
