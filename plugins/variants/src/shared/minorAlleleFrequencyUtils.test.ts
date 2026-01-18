import {
  calculateAlleleCounts,
  calculateMinorAlleleFrequency,
  getFeaturesThatPassMinorAlleleFrequencyFilter,
} from './minorAlleleFrequencyUtils.ts'

// Mock feature for testing
function createMockFeature(
  id: string,
  start: number,
  end: number,
  genotypes: Record<string, string>,
) {
  return {
    id: () => id,
    get: (key: string) => {
      if (key === 'start') {
        return start
      }
      if (key === 'end') {
        return end
      }
      if (key === 'genotypes') {
        return genotypes
      }
      return undefined
    },
  }
}

describe('calculateAlleleCounts', () => {
  it('counts alleles correctly for homozygous ref samples', () => {
    const genotypes = {
      sample1: '0/0',
      sample2: '0/0',
      sample3: '0/0',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '0': 6 })
  })

  it('counts alleles correctly for heterozygous samples', () => {
    const genotypes = {
      sample1: '0/1',
      sample2: '0/1',
      sample3: '0/1',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('counts alleles correctly for homozygous alt samples', () => {
    const genotypes = {
      sample1: '1/1',
      sample2: '1/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '1': 6 })
  })

  it('counts alleles correctly for mixed genotypes', () => {
    const genotypes = {
      sample1: '0/0',
      sample2: '0/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('handles phased genotypes with pipe separator', () => {
    const genotypes = {
      sample1: '0|0',
      sample2: '0|1',
      sample3: '1|1',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('handles missing genotypes', () => {
    const genotypes = {
      sample1: './.',
      sample2: '0/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '.': 2, '0': 1, '1': 3 })
  })

  it('handles multiallelic sites', () => {
    const genotypes = {
      sample1: '0/1',
      sample2: '0/2',
      sample3: '1/2',
    }
    const result = calculateAlleleCounts(genotypes, {})
    expect(result).toEqual({ '0': 2, '1': 2, '2': 2 })
  })
})

describe('calculateMinorAlleleFrequency', () => {
  it('returns 0 for monomorphic site (all ref)', () => {
    const alleleCounts = { '0': 10 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0)
  })

  it('returns 0 for monomorphic site (all alt)', () => {
    const alleleCounts = { '1': 10 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0)
  })

  it('calculates MAF correctly for biallelic site with different frequencies', () => {
    // 8 ref alleles, 2 alt alleles -> MAF = 2/10 = 0.2
    const alleleCounts = { '0': 8, '1': 2 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.2)
  })

  it('calculates MAF correctly when alt is more frequent', () => {
    // 2 ref alleles, 8 alt alleles -> MAF = 2/10 = 0.2
    const alleleCounts = { '0': 2, '1': 8 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.2)
  })

  it('calculates MAF correctly for equal allele frequencies', () => {
    // 5 ref alleles, 5 alt alleles -> MAF = 5/10 = 0.5
    const alleleCounts = { '0': 5, '1': 5 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.5)
  })

  it('calculates MAF correctly for multiallelic site', () => {
    // 10 ref, 5 alt1, 3 alt2 -> total 18, second most common is 5 -> MAF = 5/18
    const alleleCounts = { '0': 10, '1': 5, '2': 3 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBeCloseTo(5 / 18)
  })

  it('handles missing alleles correctly', () => {
    // Missing alleles (.) should be counted but typically aren't the minor allele
    const alleleCounts = { '0': 6, '1': 2, '.': 2 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    // Total = 10, firstMax = 6, secondMax = 2, MAF = 2/10 = 0.2
    expect(maf).toBe(0.2)
  })

  it('returns 0 for empty allele counts', () => {
    const alleleCounts = {}
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0)
  })
})

describe('MAF filter integration', () => {
  it('correctly filters variants with MAF below threshold', () => {
    // Variant with MAF = 0.1 should be filtered out with threshold 0.2
    const genotypes = {
      sample1: '0/0',
      sample2: '0/0',
      sample3: '0/0',
      sample4: '0/0',
      sample5: '0/1', // Only one het = 1 alt allele out of 10 total
    }
    const alleleCounts = calculateAlleleCounts(genotypes, {})
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.1)
    expect(maf >= 0.2).toBe(false) // Should be filtered out
  })

  it('correctly keeps variants with MAF at or above threshold', () => {
    // Variant with MAF = 0.4 should pass with threshold 0.2
    // sample1: 0/0 = 2 ref, sample2: 0/0 = 2 ref, sample3: 0/1 = 1 ref + 1 alt
    // sample4: 0/1 = 1 ref + 1 alt, sample5: 1/1 = 2 alt
    // Total: 6 ref, 4 alt -> MAF = 4/10 = 0.4
    const genotypes = {
      sample1: '0/0',
      sample2: '0/0',
      sample3: '0/1',
      sample4: '0/1',
      sample5: '1/1',
    }
    const alleleCounts = calculateAlleleCounts(genotypes, {})
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.4)
    expect(maf >= 0.2).toBe(true) // Should pass
  })
})

describe('calculateMinorAlleleFrequency edge cases', () => {
  it('handles triallelic site with two alleles tied for second', () => {
    // 10 ref, 3 alt1, 3 alt2 -> secondMax should be 3
    const alleleCounts = { '0': 10, '1': 3, '2': 3 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBeCloseTo(3 / 16)
  })

  it('handles site with three equal frequency alleles', () => {
    // All three alleles at equal frequency
    const alleleCounts = { '0': 4, '1': 4, '2': 4 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    // firstMax=4, secondMax=4, MAF = 4/12 = 1/3
    expect(maf).toBeCloseTo(1 / 3)
  })

  it('handles very rare variant (singleton)', () => {
    // 99 ref, 1 alt -> MAF = 1/100 = 0.01
    const alleleCounts = { '0': 99, '1': 1 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.01)
  })

  it('handles haploid genotypes', () => {
    const genotypes = {
      sample1: '0',
      sample2: '0',
      sample3: '1',
      sample4: '1',
    }
    const alleleCounts = calculateAlleleCounts(genotypes, {})
    expect(alleleCounts).toEqual({ '0': 2, '1': 2 })
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.5)
  })

  it('handles polyploid genotypes', () => {
    const genotypes = {
      sample1: '0/0/0/0', // tetraploid
      sample2: '0/0/0/1',
      sample3: '0/0/1/1',
    }
    const alleleCounts = calculateAlleleCounts(genotypes, {})
    // 4 + 3 + 2 = 9 ref, 0 + 1 + 2 = 3 alt
    expect(alleleCounts).toEqual({ '0': 9, '1': 3 })
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBe(0.25)
  })

  it('handles half-calls correctly', () => {
    const genotypes = {
      sample1: '0/.',
      sample2: './1',
      sample3: '0/1',
    }
    const alleleCounts = calculateAlleleCounts(genotypes, {})
    expect(alleleCounts).toEqual({ '0': 2, '.': 2, '1': 2 })
  })
})

describe('getFeaturesThatPassMinorAlleleFrequencyFilter', () => {
  it('filters out variants below MAF threshold', () => {
    const features = [
      // MAF = 0.1 (should be filtered with threshold 0.2)
      createMockFeature('snp1', 100, 101, {
        s1: '0/0',
        s2: '0/0',
        s3: '0/0',
        s4: '0/0',
        s5: '0/1',
      }),
      // MAF = 0.4 (should pass)
      createMockFeature('snp2', 200, 201, {
        s1: '0/0',
        s2: '0/1',
        s3: '0/1',
        s4: '1/1',
        s5: '1/1',
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0.2,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.feature.id()).toBe('snp2')
  })

  it('filters out variants exceeding length cutoff', () => {
    const features = [
      // Length = 1 (should pass with cutoff 10)
      createMockFeature('snp1', 100, 101, {
        s1: '0/1',
        s2: '0/1',
        s3: '0/1',
        s4: '0/1',
        s5: '0/1',
      }),
      // Length = 50 (should be filtered with cutoff 10)
      createMockFeature('indel1', 200, 250, {
        s1: '0/1',
        s2: '0/1',
        s3: '0/1',
        s4: '0/1',
        s5: '0/1',
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: 10,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.feature.id()).toBe('snp1')
  })

  it('returns mostFrequentAlt correctly', () => {
    const features = [
      createMockFeature('snp1', 100, 101, {
        s1: '0/1',
        s2: '0/1',
        s3: '1/1',
        s4: '1/1',
        s5: '1/1',
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.mostFrequentAlt).toBe('1')
  })

  it('handles multiallelic and returns most frequent alt', () => {
    const features = [
      createMockFeature('snp1', 100, 101, {
        s1: '0/1',
        s2: '0/2',
        s3: '2/2',
        s4: '2/2',
        s5: '1/2',
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(1)
    // Allele 2 appears 5 times (most frequent alt), allele 1 appears 2 times
    expect(result[0]!.mostFrequentAlt).toBe('2')
  })

  it('filters monomorphic sites (MAF = 0)', () => {
    const features = [
      createMockFeature('snp1', 100, 101, {
        s1: '0/0',
        s2: '0/0',
        s3: '0/0',
        s4: '0/0',
        s5: '0/0',
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0.01,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(0)
  })

  it('keeps variant at exact MAF threshold', () => {
    // MAF exactly 0.2
    // Actually need MAF = 0.2: 2 alt out of 10
    const features2 = [
      createMockFeature('snp1', 100, 101, {
        s1: '0/0',
        s2: '0/0',
        s3: '0/0',
        s4: '0/1',
        s5: '0/1', // 2 alt out of 10 total = 0.2
      }),
    ]

    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features2 as any,
      minorAlleleFrequencyFilter: 0.2,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(1)
  })

  it('handles empty feature list', () => {
    const result = getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: [],
      minorAlleleFrequencyFilter: 0.01,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
    })

    expect(result).toHaveLength(0)
  })

  it('uses genotypes cache when provided', () => {
    const genotypesCache = new Map<string, Record<string, string>>()
    const genotypes = { s1: '0/1', s2: '0/1', s3: '0/1', s4: '0/1', s5: '0/1' }

    const features = [createMockFeature('snp1', 100, 101, genotypes)]

    getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: features as any,
      minorAlleleFrequencyFilter: 0,
      lengthCutoffFilter: Number.MAX_SAFE_INTEGER,
      genotypesCache,
    })

    // Cache should now contain the genotypes
    expect(genotypesCache.get('snp1')).toEqual(genotypes)
  })
})
