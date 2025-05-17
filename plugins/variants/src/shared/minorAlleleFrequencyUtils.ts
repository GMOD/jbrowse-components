import { forEachWithStopTokenCheck, sum } from '@jbrowse/core/util'

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
  const genotypes = feat.get('genotypes') as Record<string, string>
  const alleleCounts = { 0: 0, 1: 0, '.': 0 } as Record<string, number>
  const cacheSplit = {} as Record<string, string[]>
  const vals = Object.values(genotypes)
  const len = vals.length
  for (let i = 0; i < len; i++) {
    const genotype = vals[i]!
    const alleles =
      cacheSplit[genotype] || (cacheSplit[genotype] = genotype.split(/[/|]/))

    for (let i = 0, len = alleles.length; i < len; i++) {
      const a = alleles[i]!
      alleleCounts[a] = (alleleCounts[a] ?? 0) + 1
    }
  }

  return alleleCounts
}

export function calculateMinorAlleleFrequency(
  alleleCounts: Record<string, number>,
) {
  return (
    findSecondLargestNumber(Object.values(alleleCounts)) /
    (sum(Object.values(alleleCounts)) || 1)
  )
}

function getMostFrequentAlt(alleleCounts: Record<string, number>) {
  let mostFrequentAlt
  let max = 0
  for (const [alt, altCount] of Object.entries(alleleCounts)) {
    if (alt !== '.' && alt !== '0') {
      if (altCount > max) {
        mostFrequentAlt = alt
        max = altCount
      }
    }
  }
  return mostFrequentAlt
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter({
  features,
  minorAlleleFrequencyFilter,
  lengthCutoffFilter,
  stopToken,
}: {
  features: Iterable<Feature>
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  stopToken?: string
}) {
  const results = [] as {
    feature: Feature
    mostFrequentAlt: string
    alleleCounts: Record<string, number>
  }[]
  forEachWithStopTokenCheck(features, stopToken, feature => {
    if (feature.get('end') - feature.get('start') <= lengthCutoffFilter) {
      const alleleCounts = calculateAlleleCounts(feature)
      if (
        calculateMinorAlleleFrequency(alleleCounts) >=
        minorAlleleFrequencyFilter
      ) {
        results.push({
          feature,
          mostFrequentAlt: getMostFrequentAlt(alleleCounts)!,
          alleleCounts,
        })
      }
    }
  })

  return results
}
