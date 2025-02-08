import { sum } from '@jbrowse/core/util'

import type { Feature} from '@jbrowse/core/util'

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

export function getFeaturesThatPassMinorAlleleFrequencyFilter(
  feats: Iterable<Feature>,
  minorAlleleFrequencyFilter: number,
) {
  const results = [] as {
    feature: Feature
    alleleCounts: Map<string, number>
  }[]
  for (const feat of feats) {
    if (feat.get('end') - feat.get('start') <= 10) {
      const alleleCounts = calculateAlleleCounts(feat)
      if (
        calculateMinorAlleleFrequency(alleleCounts) >=
        minorAlleleFrequencyFilter
      ) {
        results.push({ feature: feat, alleleCounts })
      }
    }
  }
  return results
}
