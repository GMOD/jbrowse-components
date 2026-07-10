import {
  calculateAlleleCounts,
  calculateAlleleCountsFast,
} from './alleleCounts.ts'

import type VcfFeature from '../VcfFeature/index.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

export function calculateMinorAlleleFrequency(
  alleleCounts: Record<string, number>,
) {
  let firstMax = 0
  let secondMax = 0
  let total = 0
  for (const key in alleleCounts) {
    // No-call '.' is not an allele: it must be excluded from both the
    // minor-allele candidacy and the denominator, or on sites where no-calls
    // outnumber the true minor allele the returned frequency is actually the
    // missingness fraction. No-call fraction is measured separately by
    // calculateMissingnessFrequency / the missingness filter.
    if (key !== '.') {
      const count = alleleCounts[key]!
      total += count
      if (count > firstMax) {
        secondMax = firstMax
        firstMax = count
      } else if (count > secondMax) {
        secondMax = count
      }
    }
  }
  return secondMax / (total || 1)
}

// Fraction of alleles that are no-call ('.'); high on sparse multi-sample
// panels where many samples lack a genotype at a site. This is the complement
// of the LD display's `callRateFilter` (call rate === 1 - missingness); the two
// display families expose the same concept under different names and dialogs.
export function calculateMissingnessFrequency(
  alleleCounts: Record<string, number>,
) {
  let total = 0
  for (const key in alleleCounts) {
    total += alleleCounts[key]!
  }
  const missing = alleleCounts['.'] ?? 0
  return missing / (total || 1)
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

export interface FilteredVariant {
  feature: Feature
  mostFrequentAlt: string
}

// Resolve allele counts from whichever genotype representation a feature
// carries: VcfFeature's processGenotypes callback (fastest), or a plain
// genotypes object (cached per feature id).
function computeAlleleCounts(
  feature: Feature,
  genotypesCache?: Map<string, Record<string, string>>,
) {
  let alleleCounts: Record<string, number>
  if ('processGenotypes' in feature) {
    alleleCounts = calculateAlleleCountsFast(feature as VcfFeature)
  } else {
    const featureId = feature.id()
    let genotypes = genotypesCache?.get(featureId)
    if (!genotypes) {
      genotypes = feature.get('genotypes') as Record<string, string>
      genotypesCache?.set(featureId, genotypes)
    }
    alleleCounts = calculateAlleleCounts(genotypes)
  }
  return alleleCounts
}

// The single feature-level filter chokepoint for the cell/matrix/cluster
// paths: a jexl `filterChain`, a minor-allele-frequency floor, and a
// no-call-missingness ceiling, all evaluated off the one allele-count pass.
// `maxMissingnessFilter` of 1 (or undefined) disables the missingness ceiling.
export function getFilteredVariants({
  features,
  minorAlleleFrequencyFilter,
  maxMissingnessFilter,
  filterChain,
  genotypesCache,
  report,
}: {
  features: Iterable<Feature>
  minorAlleleFrequencyFilter: number
  maxMissingnessFilter?: number
  filterChain?: SerializableFilterChain
  genotypesCache?: Map<string, Record<string, string>>
  report?: ProgressReporter
}) {
  const results: FilteredVariant[] = []
  const missingnessCeiling = maxMissingnessFilter ?? 1
  const filterMissingness = missingnessCeiling < 1

  for (const feature of features) {
    if (!filterChain || filterChain.passes(feature)) {
      const alleleCounts = computeAlleleCounts(feature, genotypesCache)
      const mostFrequentAlt = getMostFrequentAlt(alleleCounts)
      if (
        mostFrequentAlt !== undefined &&
        calculateMinorAlleleFrequency(alleleCounts) >=
          minorAlleleFrequencyFilter &&
        (!filterMissingness ||
          calculateMissingnessFrequency(alleleCounts) <= missingnessCeiling)
      ) {
        results.push({ feature, mostFrequentAlt })
      }
    }
    report?.()
  }

  return results
}
