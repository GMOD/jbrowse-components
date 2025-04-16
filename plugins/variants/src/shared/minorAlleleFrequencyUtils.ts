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
  const samp = feat.get('genotypes') as Record<string, string>
  const alleleCounts = new Map<string, number>()
  alleleCounts.set('0', 0)
  alleleCounts.set('1', 0)
  alleleCounts.set('.', 0)
  const cacheSplit = {} as Record<string, string[]>
  for (const val of Object.values(samp)) {
    if (val === '0/0' || val === '0|0') {
      alleleCounts.set('0', alleleCounts.get('0')! + 2)
    } else if (
      val === '1/0' ||
      val === '0/1' ||
      val === '1|0' ||
      val === '0|1'
    ) {
      alleleCounts.set('0', alleleCounts.get('0')! + 1)
      alleleCounts.set('1', alleleCounts.get('1')! + 1)
    } else if (val === '1/1' || val === '1|1') {
      alleleCounts.set('1', alleleCounts.get('1')! + 2)
    } else {
      let alleles: string[]
      if (cacheSplit[val]) {
        alleles = cacheSplit[val]
      } else {
        alleles = val.split(/[/|]/)
        cacheSplit[val] = alleles
      }
      const lenA = alleles.length
      for (let i = 0; i < lenA; i++) {
        const a = alleles[i]!
        const val = alleleCounts.get(a)
        if (val === undefined) {
          alleleCounts.set(a, 1)
        } else {
          alleleCounts.set(a, val + 1)
        }
      }
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
    alleleCounts: Map<string, number>
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
