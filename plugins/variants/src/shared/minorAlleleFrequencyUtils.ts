import { unwrapFeature } from '@jbrowse/core/util/simpleFeature'

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

function computeAlleleCounts(feature: Feature) {
  return hasProcessGenotypes(feature)
    ? calculateAlleleCountsFast(feature)
    : calculateAlleleCounts(
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {},
      )
}

// A jexlFeatureProxy answers `processGenotypes` through `get()`, so the jexl
// functions unwrap to reach VcfFeature's own method
function featureAlleleCounts(feature: Feature) {
  const raw = unwrapFeature(feature)
  if (hasProcessGenotypes(raw)) {
    return calculateAlleleCountsFast(raw)
  }
  const genotypes = raw.get('genotypes') as Record<string, string> | undefined
  return genotypes ? calculateAlleleCounts(genotypes) : undefined
}

export function featureMinorAlleleFrequency(feature: Feature) {
  const counts = featureAlleleCounts(feature)
  return counts ? calculateMinorAlleleFrequency(counts) : 0
}

export function featureMissingness(feature: Feature) {
  const counts = featureAlleleCounts(feature)
  return counts ? calculateMissingnessFrequency(counts) : 0
}

export interface SiteThresholds {
  minorAlleleFrequencyFilter: number
  /** 1 or undefined keeps every site */
  maxMissingnessFilter?: number
}

/**
 * Whether a site's allele summary clears the thresholds. A site with no called
 * allele anywhere has no cell to draw, so it drops whatever they are; a
 * monomorphic site is a real row of the file and stays.
 */
export function passesSiteThresholds(
  summary: ReturnType<typeof summarizeAlleleCounts>,
  { minorAlleleFrequencyFilter, maxMissingnessFilter = 1 }: SiteThresholds,
) {
  return (
    summary.calledAlleleCount > 0 &&
    summary.minorAlleleFrequency >= minorAlleleFrequencyFilter &&
    summary.missingness <= maxMissingnessFilter
  )
}

/**
 * One feature through the jexl `filterChain` and the thresholds, off one
 * allele-count pass; undefined where it fails either.
 */
export function filterVariant(
  feature: Feature,
  thresholds: SiteThresholds,
  filterChain?: SerializableFilterChain,
): FilteredVariant | undefined {
  if (filterChain && !filterChain.passes(feature)) {
    return undefined
  }
  const summary = summarizeAlleleCounts(computeAlleleCounts(feature))
  return passesSiteThresholds(summary, thresholds)
    ? { feature, mostFrequentAlt: summary.mostFrequentAlt }
    : undefined
}

/** `filterVariant` over a fetch, for the cell, matrix and cluster paths. */
export function getFilteredVariants({
  features,
  filterChain,
  report,
  ...thresholds
}: SiteThresholds & {
  features: Iterable<Feature>
  filterChain?: SerializableFilterChain
  report?: ProgressReporter
}) {
  const results: FilteredVariant[] = []
  for (const feature of features) {
    const kept = filterVariant(feature, thresholds, filterChain)
    if (kept) {
      results.push(kept)
    }
    report?.()
  }
  return results
}
