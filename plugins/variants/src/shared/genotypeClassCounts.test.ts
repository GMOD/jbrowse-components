import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import {
  getAltAlleleCount,
  getGenotypeClassCount,
  getGenotypeClassCounts,
} from './genotypeClassCounts.ts'

import type { Feature } from '@jbrowse/core/util'

function feature(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 0,
    end: 1,
    ...data,
  }) as Feature
}

function genotypes(...calls: string[]) {
  return feature({
    genotypes: Object.fromEntries(calls.map((gt, i) => [`s${i}`, gt])),
  })
}

test('ref/alt and hom/het each partition the called samples', () => {
  const counts = getGenotypeClassCounts(
    genotypes('0/0', '0|1', '1/1', '1/2', './.'),
  )
  expect(counts).toEqual({ ref: 1, alt: 3, hom: 2, het: 2, mis: 1 })
})

test('a half-called genotype counts for the allele it does state', () => {
  expect(getGenotypeClassCounts(genotypes('./1'))).toEqual({
    ref: 0,
    alt: 1,
    hom: 1,
    het: 0,
    mis: 0,
  })
})

test('an empty genotype string is a no-call, as it is for allele counts', () => {
  expect(getGenotypeClassCount(genotypes('', '0/0'), 'mis')).toBe(1)
})

test('haploid and polyploid calls', () => {
  expect(getGenotypeClassCounts(genotypes('1', '0/0/0/1'))).toEqual({
    ref: 0,
    alt: 2,
    hom: 1,
    het: 1,
    mis: 0,
  })
})

test('a sites-only record has no genotypes to count', () => {
  expect(getGenotypeClassCounts(feature({}))).toEqual({
    ref: 0,
    alt: 0,
    hom: 0,
    het: 0,
    mis: 0,
  })
})

test('an unknown class names the ones that exist rather than reading 0', () => {
  expect(() => {
    getGenotypeClassCount(genotypes('0/1'), 'hets')
  }).toThrow(/unknown genotype class 'hets'.*ref, alt, hom, het, mis/)
})

test('nAlt counts alleles, not the length of the first one', () => {
  expect(getAltAlleleCount(feature({ ALT: ['ACGT'] }))).toBe(1)
  expect(getAltAlleleCount(feature({ ALT: ['A', 'G'] }))).toBe(2)
  expect(getAltAlleleCount(feature({}))).toBe(0)
})
