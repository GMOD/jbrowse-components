import { sum } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

export function findSecondLargestNumber(arr: Iterable<number>) {
  let firstMax = 0
  let secondMax = 0

  for (const num of arr) {
    if (num > firstMax) {
      secondMax = firstMax
      firstMax = num
    } else if (num > secondMax && num !== firstMax) {
      secondMax = num
    }
  }

  return secondMax
}

export function calculateAlleleCounts(feat: Feature) {
  const samp = feat.get('genotypes') as Record<string, string>
  const alleleCounts = new Map()
  for (const val of Object.values(samp)) {
    const alleles = val.split(/[/|]/)
    for (const allele of alleles) {
      alleleCounts.set(allele, (alleleCounts.get(allele) || 0) + 1)
    }
  }
  let mostFrequentAlt
  let max = 0
  for (const [alt, altCount] of alleleCounts.entries()) {
    if (alt !== '.' && alt !== '0') {
      if (altCount > max) {
        mostFrequentAlt = alt
        max = altCount
      }
    }
  }

  return { alleleCounts, mostFrequentAlt }
}

export function calculateMinorAlleleFrequency(
  alleleCounts: Map<string, number>,
) {
  return (
    findSecondLargestNumber(alleleCounts.values()) /
    (sum(alleleCounts.values()) || 1)
  )
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter(
  feats: Iterable<Feature>,
  minorAlleleFrequencyFilter: number,
) {
  const results = [] as {
    feature: Feature
    mostFrequentAlt: string
  }[]
  for (const feature of feats) {
    if (feature.get('end') - feature.get('start') <= 10) {
      const { mostFrequentAlt, alleleCounts } = calculateAlleleCounts(feature)
      if (
        calculateMinorAlleleFrequency(alleleCounts) >=
        minorAlleleFrequencyFilter
      ) {
        results.push({
          feature,
          mostFrequentAlt,
        })
      }
    }
  }
  return results
}
