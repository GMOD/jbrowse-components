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
  const D = covG / 4

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
    expect(stats.r2).toBeCloseTo(1.0)
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
    expect(stats.r2).toBeCloseTo(1.0)
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
    expect(stats.r2).toBeCloseTo(1.0)
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
    expect(stats.r2).toBeLessThan(1.0)
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
    expect(stats.r2).toBeCloseTo(1.0)
  })
})
