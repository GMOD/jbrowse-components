import { GENOTYPE_SPLITTER } from './constants.ts'
import { hasProcessGenotypes } from './hasProcessGenotypes.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The genotype classes bcftools' `GT="..."` names, so a filter written against
 * its docs transliterates. `ref`/`alt` and `hom`/`het` each partition the called
 * samples; `mis` is the rest.
 */
export const GENOTYPE_CLASSES = ['ref', 'alt', 'hom', 'het', 'mis'] as const

export type GenotypeClass = (typeof GENOTYPE_CLASSES)[number]

export type GenotypeClassCounts = Record<GenotypeClass, number>

// A no-call allele is skipped rather than condemning the whole genotype: `mis`
// is a genotype stating no allele at all, so a half-called './1' is counted for
// the allele it does state. That makes `hom` "no two different alleles were
// called" rather than "every allele is the same", which is the reading under
// which the pairs above stay partitions on a callset carrying partial calls.
function countGenotype(genotype: string, counts: GenotypeClassCounts) {
  let called = 0
  let first = ''
  let uniform = true
  let anyAlt = false
  for (const allele of genotype.split(GENOTYPE_SPLITTER)) {
    if (allele !== '.' && allele !== '') {
      called++
      if (called === 1) {
        first = allele
      } else if (allele !== first) {
        uniform = false
      }
      if (allele !== '0') {
        anyAlt = true
      }
    }
  }
  if (called === 0) {
    counts.mis++
  } else {
    counts[anyAlt ? 'alt' : 'ref']++
    counts[uniform ? 'hom' : 'het']++
  }
}

/**
 * Samples in each genotype class at a site — the per-sample tally bcftools'
 * `N_PASS(GT="het")` answers, which the per-allele counts in `alleleCounts.ts`
 * cannot: two samples at 0/1 and one at 1/1 are the same four alt alleles as one
 * sample at 1/1 plus two at 1/0, and only this tally tells them apart.
 */
export function getGenotypeClassCounts(feature: Feature) {
  const counts: GenotypeClassCounts = {
    ref: 0,
    alt: 0,
    hom: 0,
    het: 0,
    mis: 0,
  }
  if (hasProcessGenotypes(feature)) {
    // A substring per sample, unlike calculateAlleleCountsFast's charCode scan:
    // this runs only for a track someone has written a genotypeCount filter on,
    // where the allocation buys a tenth of that function's length.
    feature.processGenotypes((str, start, end) => {
      countGenotype(str.slice(start, end), counts)
    })
  } else {
    const genotypes = feature.get('genotypes') as
      | Record<string, string>
      | undefined
    for (const key in genotypes) {
      countGenotype(genotypes[key]!, counts)
    }
  }
  return counts
}

export function getGenotypeClassCount(feature: Feature, cls: string) {
  if (!GENOTYPE_CLASSES.includes(cls as GenotypeClass)) {
    throw new Error(
      `genotypeCount: unknown genotype class '${cls}', expected one of ${GENOTYPE_CLASSES.join(', ')}`,
    )
  }
  return getGenotypeClassCounts(feature)[cls as GenotypeClass]
}

/**
 * ALT alleles the record declares (bcftools `N_ALT`), for the biallelic-only
 * filter that is most of what it is used for. Its jexl spelling is a function
 * rather than `feature.ALT.length` because jexl resolves a member access on an
 * array against its *first element*, so that expression silently returns the
 * length of the first allele string.
 */
export function getAltAlleleCount(feature: Feature) {
  const alt = feature.get('ALT') as string[] | undefined
  return alt?.length ?? 0
}
