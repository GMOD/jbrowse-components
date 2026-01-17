import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'

const GENOTYPE_SPLIT_REGEX = /[/|]/

export function calculateAlleleCounts(
  genotypes: Record<string, string>,
  cacheSplit: Record<string, string[]>,
) {
  const alleleCounts = {} as Record<string, number>
  for (const key in genotypes) {
    const genotype = genotypes[key]!
    const len = genotype.length

    // Fast path for common diploid genotypes like "0/1" or "0|1"
    if (len === 3) {
      const sep = genotype[1]
      if (sep === '/' || sep === '|') {
        const a0 = genotype[0]!
        const a1 = genotype[2]!
        alleleCounts[a0] = (alleleCounts[a0] || 0) + 1
        alleleCounts[a1] = (alleleCounts[a1] || 0) + 1
        continue
      }
    }

    // Fast path for haploid
    if (len === 1) {
      alleleCounts[genotype] = (alleleCounts[genotype] || 0) + 1
      continue
    }

    // General case: polyploid or multi-digit alleles - use cache
    let alleles = cacheSplit[genotype]
    if (!alleles) {
      alleles = genotype.split(GENOTYPE_SPLIT_REGEX)
      cacheSplit[genotype] = alleles
    }
    for (const allele of alleles) {
      alleleCounts[allele] = (alleleCounts[allele] || 0) + 1
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
  for (const key in alleleCounts) {
    const count = alleleCounts[key]!
    total += count
    if (count > firstMax) {
      secondMax = firstMax
      firstMax = count
    } else if (count > secondMax) {
      secondMax = count
    }
  }
  return secondMax / (total || 1)
}

function getMostFrequentAlt(alleleCounts: Record<string, number>) {
  let mostFrequentAlt
  let max = 0
  for (const alt in alleleCounts) {
    const altCount = alleleCounts[alt]!
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
