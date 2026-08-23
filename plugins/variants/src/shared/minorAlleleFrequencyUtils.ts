import {
  calculateAlleleCounts,
  calculateAlleleCountsFast,
} from './alleleCounts.ts'
import { hasProcessGenotypes } from './hasProcessGenotypes.ts'

import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

export interface AlleleSummary {
  // Frequency of the second-most-common allele among *called* alleles (the VCF
  // AN definition). No-call '.' is not an allele: it is excluded from both the
  // minor-allele candidacy and the denominator — counted as one, a site whose
  // no-calls outnumber its true minor allele would report the missingness
  // fraction here instead. Missingness is its own metric below.
  minorAlleleFrequency: number
  // Fraction of all alleles that are no-call ('.'); high on sparse multi-sample
  // panels where many samples lack a genotype at a site. This is the complement
  // of the LD display's `callRateFilter` (call rate === 1 - missingness); the
  // two display families expose the same concept under different names.
  missingness: number
  // Most common non-ref allele index. It only ever selects "primary alt" vs
  // "other alt" coloring (getAlleleColor / getPhasedColor), so a site carrying
  // no alt allele reports '1': no cell there holds an alt to compare against.
  mostFrequentAlt: string
  // Called (non-'.') alleles across every sample. 0 means the site has no
  // genotype data at all — every sample no-call, or a sites-only VCF.
  calledAlleleCount: number
}

// One pass over the allele counts yields everything the filter chokepoint and
// the jexl functions need. Kept as a single implementation because the MAF and
// missingness denominators have to stay in lockstep about '.'.
export function summarizeAlleleCounts(
  alleleCounts: Record<string, number>,
): AlleleSummary {
  let firstMax = 0
  let secondMax = 0
  let altMax = 0
  let called = 0
  let missing = 0
  let mostFrequentAlt = '1'
  for (const key in alleleCounts) {
    const count = alleleCounts[key]!
    if (key === '.') {
      missing += count
    } else {
      called += count
      if (count > firstMax) {
        secondMax = firstMax
        firstMax = count
      } else if (count > secondMax) {
        secondMax = count
      }
      if (key !== '0' && count > altMax) {
        altMax = count
        mostFrequentAlt = key
      }
    }
  }
  const total = called + missing
  return {
    minorAlleleFrequency: called > 0 ? secondMax / called : 0,
    missingness: total > 0 ? missing / total : 0,
    mostFrequentAlt,
    calledAlleleCount: called,
  }
}

export function calculateMinorAlleleFrequency(
  alleleCounts: Record<string, number>,
) {
  return summarizeAlleleCounts(alleleCounts).minorAlleleFrequency
}

export function calculateMissingnessFrequency(
  alleleCounts: Record<string, number>,
) {
  return summarizeAlleleCounts(alleleCounts).missingness
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
  if (hasProcessGenotypes(feature)) {
    alleleCounts = calculateAlleleCountsFast(feature)
  } else {
    const featureId = feature.id()
    let genotypes = genotypesCache?.get(featureId)
    if (!genotypes) {
      // A sites-only VCF has no genotypes field at all; normalize to {} so the
      // cache never hands a later consumer an undefined it has to re-guard.
      genotypes =
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {}
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

  for (const feature of features) {
    if (!filterChain || filterChain.passes(feature)) {
      const {
        minorAlleleFrequency,
        missingness,
        mostFrequentAlt,
        calledAlleleCount,
      } = summarizeAlleleCounts(computeAlleleCounts(feature, genotypesCache))
      // A site with no called allele anywhere has no cell to draw, so it drops
      // regardless of the thresholds. A monomorphic site does *not*: with the
      // filters off it is a real row of the file, and dropping the all-ref case
      // while keeping the all-alt one was an asymmetry, not a filter decision.
      if (
        calledAlleleCount > 0 &&
        minorAlleleFrequency >= minorAlleleFrequencyFilter &&
        missingness <= missingnessCeiling
      ) {
        results.push({ feature, mostFrequentAlt })
      }
    }
    report?.()
  }

  return results
}
