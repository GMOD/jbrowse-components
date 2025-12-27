import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'

export function calculateAlleleCounts(
  genotypes: Record<string, string>,
  cacheSplit: Record<string, string[]>,
) {
  const alleleCounts = {} as Record<string, number>
  const vals = Object.values(genotypes)
  for (const val of vals) {
    const genotype = val
    const alleles =
      cacheSplit[genotype] ?? (cacheSplit[genotype] = genotype.split(/[/|]/))
    for (const allele of alleles) {
      const a = allele
      alleleCounts[a] = (alleleCounts[a] || 0) + 1
    }
  }
  return alleleCounts
}

export function calculateMinorAlleleFrequency(
  alleleCounts: Record<string, number>,
) {
  let firstMax = 0
  let secondMax = 0
  let total = 0
  for (const count of Object.values(alleleCounts)) {
    total += count
    if (count > firstMax) {
      secondMax = firstMax
      firstMax = count
    } else if (count > secondMax && count !== firstMax) {
      secondMax = count
    }
  }
  return secondMax / (total || 1)
}

function getMostFrequentAlt(alleleCounts: Record<string, number>) {
  let mostFrequentAlt
  let max = 0
  for (const [alt, altCount] of Object.entries(alleleCounts)) {
    if (alt !== '.' && alt !== '0' && altCount > max) {
      mostFrequentAlt = alt
      max = altCount
    }
  }
  return mostFrequentAlt
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter({
  features,
  minorAlleleFrequencyFilter,
  lengthCutoffFilter,
  lastCheck,
  genotypesCache,
  splitCache = {},
}: {
  features: Iterable<Feature>
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  lastCheck?: LastStopTokenCheck
  genotypesCache?: Map<string, Record<string, string>>
  splitCache?: Record<string, string[]>
}) {
  const results = [] as {
    feature: Feature
    mostFrequentAlt: string
    alleleCounts: Record<string, number>
  }[]

  for (const feature of features) {
    if (feature.get('end') - feature.get('start') <= lengthCutoffFilter) {
      const featureId = feature.id()
      let genotypes = genotypesCache?.get(featureId)
      if (!genotypes) {
        genotypes = feature.get('genotypes') as Record<string, string>
        genotypesCache?.set(featureId, genotypes)
      }

      const alleleCounts = calculateAlleleCounts(genotypes, splitCache)
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
    checkStopToken2(lastCheck)
  }

  return results
}
