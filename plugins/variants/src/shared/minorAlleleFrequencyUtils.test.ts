import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { calculateAlleleCounts } from './alleleCounts.ts'
import {
  calculateMinorAlleleFrequency,
  calculateMissingnessFrequency,
  getFilteredVariants,
} from './minorAlleleFrequencyUtils.ts'

import type { Feature } from '@jbrowse/core/util'

// Mock feature for testing
function createMockFeature(
  id: string,
  start: number,
  end: number,
  genotypes: Record<string, string>,
): Feature {
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
  } as unknown as Feature
}

describe('calculateAlleleCounts', () => {
  it('counts alleles correctly for homozygous ref samples', () => {
    const genotypes = {
      sample1: '0/0',
      sample2: '0/0',
      sample3: '0/0',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '0': 6 })
  })

  it('counts alleles correctly for heterozygous samples', () => {
    const genotypes = {
      sample1: '0/1',
      sample2: '0/1',
      sample3: '0/1',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('counts alleles correctly for homozygous alt samples', () => {
    const genotypes = {
      sample1: '1/1',
      sample2: '1/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '1': 6 })
  })

  it('counts alleles correctly for mixed genotypes', () => {
    const genotypes = {
      sample1: '0/0',
      sample2: '0/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('handles phased genotypes with pipe separator', () => {
    const genotypes = {
      sample1: '0|0',
      sample2: '0|1',
      sample3: '1|1',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '0': 3, '1': 3 })
  })

  it('handles missing genotypes', () => {
    const genotypes = {
      sample1: './.',
      sample2: '0/1',
      sample3: '1/1',
    }
    const result = calculateAlleleCounts(genotypes)
    expect(result).toEqual({ '.': 2, '0': 1, '1': 3 })
  })

  it('handles multiallelic sites', () => {
    const genotypes = {
      sample1: '0/1',
      sample2: '0/2',
      sample3: '1/2',
    }
    const result = calculateAlleleCounts(genotypes)
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

  it('excludes no-call alleles from the denominator', () => {
    // No-call (.) is not an allele: MAF is over called alleles only.
    const alleleCounts = { '0': 6, '1': 2, '.': 2 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    // Called total = 8, firstMax = 6, secondMax = 2, MAF = 2/8 = 0.25
    expect(maf).toBe(0.25)
  })

  it('does not report missingness as the minor allele frequency', () => {
    // No-calls (30) outnumber the true minor allele (1 -> 20). If '.' were
    // treated as an allele, secondMax would be the no-calls (0.30). It must be
    // the real minor allele over called alleles: 20 / (50 + 20) = 0.2857.
    const alleleCounts = { '0': 50, '1': 20, '.': 30 }
    const maf = calculateMinorAlleleFrequency(alleleCounts)
    expect(maf).toBeCloseTo(20 / 70)
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
    const alleleCounts = calculateAlleleCounts(genotypes)
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
    const alleleCounts = calculateAlleleCounts(genotypes)
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
    const alleleCounts = calculateAlleleCounts(genotypes)
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
    const alleleCounts = calculateAlleleCounts(genotypes)
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
    const alleleCounts = calculateAlleleCounts(genotypes)
    expect(alleleCounts).toEqual({ '0': 2, '.': 2, '1': 2 })
  })
})

describe('getFilteredVariants', () => {
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

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0.2,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.feature.id()).toBe('snp2')
  })

  it('applies a jexl filter chain (e.g. length filtering via jexl)', () => {
    const features = [
      // Length 1 — passes the jexl length filter below
      createMockFeature('snp1', 100, 101, { s1: '0/1', s2: '0/1' }),
      // Length 50 — filtered out by the jexl length filter
      createMockFeature('indel1', 200, 250, { s1: '0/1', s2: '0/1' }),
    ]

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0,
      filterChain: new SerializableFilterChain({
        filters: ["jexl:get(feature,'end')-get(feature,'start')<10"],
        jexl: createJexlInstance(),
      }),
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

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0,
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

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0,
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

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0.01,
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

    const result = getFilteredVariants({
      features: features2,
      minorAlleleFrequencyFilter: 0.2,
    })

    expect(result).toHaveLength(1)
  })

  it('handles empty feature list', () => {
    const result = getFilteredVariants({
      features: [],
      minorAlleleFrequencyFilter: 0.01,
    })

    expect(result).toHaveLength(0)
  })

  it('uses genotypes cache when provided', () => {
    const genotypesCache = new Map<string, Record<string, string>>()
    const genotypes = { s1: '0/1', s2: '0/1', s3: '0/1', s4: '0/1', s5: '0/1' }

    const features = [createMockFeature('snp1', 100, 101, genotypes)]

    getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0,
      genotypesCache,
    })

    // Cache should now contain the genotypes
    expect(genotypesCache.get('snp1')).toEqual(genotypes)
  })

  it('filters out variants above the missingness ceiling', () => {
    const features = [
      // 3/5 samples no-call => missingness 0.6
      createMockFeature('sparse', 100, 101, {
        s1: './.',
        s2: './.',
        s3: './.',
        s4: '0/1',
        s5: '1/1',
      }),
      // no missing calls => missingness 0
      createMockFeature('dense', 200, 201, {
        s1: '0/0',
        s2: '0/1',
        s3: '0/1',
        s4: '1/1',
        s5: '1/1',
      }),
    ]

    const result = getFilteredVariants({
      features,
      minorAlleleFrequencyFilter: 0,
      maxMissingnessFilter: 0.5,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.feature.id()).toBe('dense')
  })

  it('keeps every variant when the missingness ceiling is 1 (default)', () => {
    const features = [
      createMockFeature('sparse', 100, 101, {
        s1: './.',
        s2: './.',
        s3: './.',
        s4: '0/1',
        s5: '1/1',
      }),
    ]

    expect(
      getFilteredVariants({
        features,
        minorAlleleFrequencyFilter: 0,
        maxMissingnessFilter: 1,
      }),
    ).toHaveLength(1)
    // undefined behaves the same as the no-filter ceiling
    expect(
      getFilteredVariants({
        features,
        minorAlleleFrequencyFilter: 0,
      }),
    ).toHaveLength(1)
  })

  it('keeps a variant at the exact missingness ceiling', () => {
    const features = [
      // 2/5 samples no-call => missingness exactly 0.4
      createMockFeature('snp1', 100, 101, {
        s1: './.',
        s2: './.',
        s3: '0/1',
        s4: '0/1',
        s5: '1/1',
      }),
    ]

    expect(
      getFilteredVariants({
        features,
        minorAlleleFrequencyFilter: 0,
        maxMissingnessFilter: 0.4,
      }),
    ).toHaveLength(1)
  })
})

describe('calculateMissingnessFrequency', () => {
  it('returns 0 when nothing is missing', () => {
    expect(calculateMissingnessFrequency({ '0': 6, '1': 4 })).toBe(0)
  })

  it('returns the no-call fraction of all alleles', () => {
    // 2 no-call alleles out of 10 total
    expect(calculateMissingnessFrequency({ '.': 2, '0': 4, '1': 4 })).toBe(0.2)
  })

  it('returns 1 when every allele is missing', () => {
    expect(calculateMissingnessFrequency({ '.': 8 })).toBe(1)
  })

  it('returns 0 for empty allele counts', () => {
    expect(calculateMissingnessFrequency({})).toBe(0)
  })
})
