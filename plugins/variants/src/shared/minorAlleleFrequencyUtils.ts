import { compilePredicates } from '@jbrowse/core/util/fieldPredicate'
import { unwrapFeature } from '@jbrowse/core/util/simpleFeature'

import {
  calculateAlleleCounts,
  calculateAlleleCountsFast,
} from './alleleCounts.ts'
import { hasProcessGenotypes } from './hasProcessGenotypes.ts'

import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

export interface AlleleSummary {
  // Frequency of the second-most-common allele among *called* alleles (the VCF
  // AN definition). No-call '.' is not an allele: it is excluded from both the
  // minor-allele candidacy and the denominator — counted as one, a site whose
  // no-calls outnumber its true minor allele would report the missingness
  // fraction here instead. Missingness is its own metric below.
  minorAlleleFrequency: number
  // Fraction of all alleles that are no-call ('.'); high on sparse multi-sample
  // panels where many samples lack a genotype at a site.
  missingness: number
  // The ALT indices a sample carries, most frequent first and ties in file
  // order, which phased mode's allele hues are dealt in (`alleleHues.ts`).
  // `*`, the spanning deletion, is last whatever its count: it marks an
  // overlapping deletion's carrier rather than this site's variant, so it
  // never takes the first hue, and a site carrying no other alt leads with
  // '1'.
  altOrder: readonly string[]
  // Called (non-'.') alleles across every sample. 0 means the site has no
  // genotype data at all — every sample no-call, or a sites-only VCF.
  calledAlleleCount: number
}

// The order of a site carrying only the first alt, or none, the usual case,
// shared so it allocates nothing
const FIRST_ALT_ONLY: readonly string[] = ['1']

// Whether alt `a` ranks strictly ahead of `b`: `*` last, the rest by count
function ranksAhead(
  a: string,
  b: string,
  alleleCounts: Record<string, number>,
  spanningDeletion: string,
) {
  return (
    a !== spanningDeletion &&
    (b === spanningDeletion || alleleCounts[a]! > alleleCounts[b]!)
  )
}

// An insertion sort, since a site carries a handful of alts, with no
// comparator closure per site. It is stable, and `for...in` lists an
// object's integer keys ascending, so ties keep file order.
function sortAlts(
  alts: string[],
  alleleCounts: Record<string, number>,
  spanningDeletion: string,
) {
  for (let i = 1; i < alts.length; i++) {
    const alt = alts[i]!
    let j = i - 1
    while (
      j >= 0 &&
      ranksAhead(alt, alts[j]!, alleleCounts, spanningDeletion)
    ) {
      alts[j + 1] = alts[j]!
      j--
    }
    alts[j + 1] = alt
  }
  return alts
}

function soleAltOrder(alt: string | undefined, spanningDeletion: string) {
  return alt === spanningDeletion
    ? ['1', alt]
    : alt === undefined || alt === '1'
      ? FIRST_ALT_ONLY
      : [alt]
}

// One pass over the allele counts yields everything the filter chokepoint and
// the jexl functions need. Kept as a single implementation because the MAF and
// missingness denominators have to stay in lockstep about '.'.
export function summarizeAlleleCounts(
  alleleCounts: Record<string, number>,
  alt?: readonly unknown[],
): AlleleSummary {
  const spanningDeletion = String((alt?.indexOf('*') ?? -1) + 1)
  let firstMax = 0
  let secondMax = 0
  let called = 0
  let missing = 0
  let firstAlt: string | undefined
  let alts: string[] | undefined
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
      if (key !== '0') {
        if (firstAlt === undefined) {
          firstAlt = key
        } else if (alts === undefined) {
          alts = [firstAlt, key]
        } else {
          alts.push(key)
        }
      }
    }
  }
  const total = called + missing
  return {
    minorAlleleFrequency: called > 0 ? secondMax / called : 0,
    missingness: total > 0 ? missing / total : 0,
    altOrder: alts
      ? sortAlts(alts, alleleCounts, spanningDeletion)
      : soleAltOrder(firstAlt, spanningDeletion),
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
  altOrder: readonly string[]
}

function computeAlleleCounts(feature: Feature) {
  return hasProcessGenotypes(feature)
    ? calculateAlleleCountsFast(feature)
    : calculateAlleleCounts(
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {},
      )
}

// A site's allele summary: the one VcfFeature counted already, if it did
function siteSummaryOf(feature: Feature): AlleleSummary {
  const raw = unwrapFeature(feature) as Feature & {
    alleleSummary?: () => AlleleSummary
  }
  return typeof raw.alleleSummary === 'function'
    ? raw.alleleSummary()
    : summarizeAlleleCounts(computeAlleleCounts(feature))
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

/** The `filter` fields a site's allele summary answers, beside the record's own. */
export const SITE_FILTER_FIELDS: readonly string[] = [
  'minorAlleleFrequency',
  'missingness',
]

export function isSiteField(field: string) {
  return SITE_FILTER_FIELDS.includes(field)
}

/**
 * The site test the `filter` list's site fields compile to, once per fetch. A
 * site with no called allele anywhere has no cell to draw, so it fails
 * whatever they say (`analyzeVariants` keeps it for the records band where
 * `keepUncalledSites` allows); a monomorphic site is a real row of the file
 * and stays.
 */
export function compileSiteFilter(
  siteFilter: readonly FieldPredicate[] | undefined,
) {
  const keeps = compilePredicates<AlleleSummary>(
    (siteFilter ?? []).filter(p => isSiteField(p.field)),
    field => ({
      kind: 'get',
      get:
        field === 'minorAlleleFrequency'
          ? s => s.minorAlleleFrequency
          : s => s.missingness,
    }),
  )
  return (summary: AlleleSummary) =>
    summary.calledAlleleCount > 0 && (keeps === undefined || keeps(summary))
}

/**
 * One feature through the jexl `filterChain` and the site test, off one
 * allele-count pass; undefined where it fails either.
 */
export function filterVariant(
  feature: Feature,
  passesSite: (summary: AlleleSummary) => boolean,
  filterChain?: SerializableFilterChain,
): FilteredVariant | undefined {
  if (filterChain && !filterChain.passes(feature)) {
    return undefined
  }
  const summary = siteSummaryOf(feature)
  return passesSite(summary)
    ? { feature, altOrder: summary.altOrder }
    : undefined
}
