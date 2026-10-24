import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  lowerBoundOf,
  predicatesOf,
  withLowerBound,
} from '@jbrowse/core/util/fieldPredicate'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'

import { layerFilterProblems } from './layerFilterProblems.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const FRACTION = 'fraction'

/**
 * #config CoverageAlleles
 * #category display
 * The coverage band's `alleles` layer: the colored segment each mismatched
 * base takes in its position's depth bar. Its `filter` keeps the segments
 * whose `fraction`, the allele's share of the position's depth, passes;
 * the grey depth bar shows through where a segment is left out, and
 * everywhere under `show: false`. The modification bars are not allele
 * segments: `pileup.bases` draws them, and nothing here hides or floors
 * them.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { alleles: { filter: [{ field: 'fraction', gte: 0.2 }] } },
 * }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { alleles: { show: false } } }
 * ```
 */
export const coverageAllelesConfigSchema = ConfigurationSchema(
  'CoverageAlleles',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'color the allele segments of the depth bars; off, the bars are plain grey',
    },
    /**
     * #slot filter
     * Entries on `fraction`, a floor from 0 to 1 written `gte`, the one
     * test the band's draw makes. Empty colors every mismatch,
     * sequencing errors included. Distinct from `pileup.fadeLowFrequency`,
     * which fades the pileup's marks by the same share through a
     * depth-dependent threshold.
     */
    filter: fieldPredicateList(),
  },
  { closed: true },
)

/** The least share of its position's depth an allele segment colors at. */
export function alleleFloorOf(filter: unknown) {
  return lowerBoundOf(predicatesOf(filter), FRACTION) ?? 0
}

/** The `alleles.filter` list with its `fraction` floor set; 0 removes it. */
export function withAlleleFloor(
  filter: unknown,
  fraction: number,
): FieldPredicate[] {
  return withLowerBound(
    predicatesOf(filter),
    FRACTION,
    fraction > 0 ? fraction : undefined,
  )
}

/** The `alleles.filter` entries the band's draw cannot apply. */
export function alleleFilterProblems(filter: unknown) {
  return layerFilterProblems('coverage.alleles.filter', filter, {
    [FRACTION]: { tests: ['gte'], max: 1 },
  })
}
