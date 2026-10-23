import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { floorOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'

import { layerFilterProblems } from './layerFilterProblems.ts'

import type { Floor } from '@jbrowse/core/util/fieldPredicate'

/**
 * #config CoverageInterbase
 * #category display
 * The coverage band's `interbase` layer: the insertion and clip count bars
 * and their indicator triangles, drawn between the bases they sit between.
 * Its `filter` picks the positions that earn a triangle.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { interbase: { show: false } } }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { interbase: { filter: [{ field: 'fraction', gt: 0.1 }] } },
 * }
 * ```
 */
export const coverageInterbaseConfigSchema = ConfigurationSchema(
  'CoverageInterbase',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the insertion and clip count bars and their indicator triangles',
    },
    /**
     * #slot filter
     * Which positions get an indicator triangle, by `depth`, the reads
     * covering the position, and `fraction`, its insertions and clips as a
     * share of that depth, each a floor written `gte` or `gt`. Unwritten, a
     * field keeps its default, `depth` at least 8 and `fraction` above 0.3;
     * an entry naming a field with no test, `{ field: 'depth' }`, drops that
     * field's default.
     */
    filter: fieldPredicateList(),
  },
  { closed: true },
)

/** The depth and share a position needs for an indicator triangle. */
export interface InterbaseIndicatorRule {
  depth: Floor
  fraction: Floor
}

export const DEFAULT_INTERBASE_INDICATOR_RULE: InterbaseIndicatorRule = {
  depth: { min: 8, strict: false },
  fraction: { min: 0.3, strict: true },
}

const NO_FLOOR: Floor = { min: 0, strict: false }

/** The rule an `interbase.filter` list states, each field over its default. */
export function interbaseIndicatorRuleOf(
  filter: unknown,
): InterbaseIndicatorRule {
  const predicates = predicatesOf(filter)
  const floor = (field: 'depth' | 'fraction') =>
    predicates.some(p => p.field === field)
      ? (floorOf(predicates, field) ?? NO_FLOOR)
      : DEFAULT_INTERBASE_INDICATOR_RULE[field]
  return { depth: floor('depth'), fraction: floor('fraction') }
}

/** The `interbase.filter` entries the triangle rule cannot apply. */
export function interbaseFilterProblems(filter: unknown) {
  return layerFilterProblems('coverage.interbase.filter', filter, {
    depth: { tests: ['gte', 'gt'] },
    fraction: { tests: ['gte', 'gt'], max: 1 },
  })
}
