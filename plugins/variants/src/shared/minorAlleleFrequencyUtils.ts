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

  return alleleCounts
}

export function calculateMinorAlleleFrequency(
  alleleCounts: Map<string, number>,
) {
  return (
    findSecondLargestNumber(alleleCounts.values()) /
    (sum(alleleCounts.values()) || 1)
  )
}

function getMostFrequentAlt(alleleCounts: Map<string, number>) {
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
  return mostFrequentAlt
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter(
  feats: Iterable<Feature>,
  minorAlleleFrequencyFilter: number,
  lengthCutoffFilter = 10,
) {
  const results = [] as {
    feature: Feature
    mostFrequentAlt: string
    alleleCounts: Map<string, number>
  }[]
  for (const feature of feats) {
    if (feature.get('end') - feature.get('start') <= lengthCutoffFilter) {
      const alleleCounts = calculateAlleleCounts(feature)
      if (
        calculateMinorAlleleFrequency(alleleCounts) >=
        minorAlleleFrequencyFilter
      ) {
        const mostFrequentAlt = getMostFrequentAlt(alleleCounts)!
        results.push({
          feature,
          mostFrequentAlt,
          alleleCounts,
        })
      }
    }
  }
  return results
}
