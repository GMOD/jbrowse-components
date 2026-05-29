import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import {
  calculateAlleleCounts,
  calculateAlleleCountsFast,
  calculateAlleleCountsFromRaw,
} from './alleleCounts.ts'
import { getRawCallGenotype } from './rawGenotypes.ts'

import type VcfFeature from '../VcfFeature/index.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'

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

export interface MAFFilteredFeature {
  feature: Feature
  mostFrequentAlt: string
}

// Resolve allele counts from whichever genotype representation a feature
// carries: VcfFeature's processGenotypes callback (fastest), a packed int8
// callGenotype array, or a plain genotypes object (cached per feature id).
function computeAlleleCounts(
  feature: Feature,
  genotypesCache?: Map<string, Record<string, string>>,
) {
  let alleleCounts: Record<string, number>
  if ('processGenotypes' in feature) {
    alleleCounts = calculateAlleleCountsFast(feature as VcfFeature)
  } else {
    const rawGt = getRawCallGenotype(feature)
    if (rawGt) {
      alleleCounts = calculateAlleleCountsFromRaw(rawGt)
    } else {
      const featureId = feature.id()
      let genotypes = genotypesCache?.get(featureId)
      if (!genotypes) {
        genotypes = feature.get('genotypes') as Record<string, string>
        genotypesCache?.set(featureId, genotypes)
      }
      alleleCounts = calculateAlleleCounts(genotypes)
    }
  }
  return alleleCounts
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter({
  features,
  minorAlleleFrequencyFilter,
  filterChain,
  stopTokenCheck,
  genotypesCache,
}: {
  features: Iterable<Feature>
  minorAlleleFrequencyFilter: number
  filterChain?: SerializableFilterChain
  stopTokenCheck?: LastStopTokenCheck
  genotypesCache?: Map<string, Record<string, string>>
}) {
  const results: MAFFilteredFeature[] = []

  for (const feature of features) {
    if (!filterChain || filterChain.passes(feature)) {
      const alleleCounts = computeAlleleCounts(feature, genotypesCache)
      const mostFrequentAlt = getMostFrequentAlt(alleleCounts)
      if (
        mostFrequentAlt !== undefined &&
        calculateMinorAlleleFrequency(alleleCounts) >=
          minorAlleleFrequencyFilter
      ) {
        results.push({ feature, mostFrequentAlt })
      }
    }
    checkStopToken2(stopTokenCheck)
  }

  return results
}
