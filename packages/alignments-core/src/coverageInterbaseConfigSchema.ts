import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { lowerBoundOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'

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
     * share of that depth. Unwritten, a field keeps its default, `depth` at
     * least 8 and `fraction` above 0.3; an entry naming a field with no test,
     * `{ field: 'depth' }`, drops that field's default.
     */
    filter: fieldPredicateList(),
  },
  { closed: true },
)

/** The depth and share a position needs for an indicator triangle. */
export interface InterbaseIndicatorRule {
  minDepth: number
  minFraction: number
}

export const DEFAULT_INTERBASE_INDICATOR_RULE: InterbaseIndicatorRule = {
  minDepth: 8,
  minFraction: 0.3,
}

/** The rule an `interbase.filter` list states, each field over its default. */
export function interbaseIndicatorRuleOf(
  filter: unknown,
): InterbaseIndicatorRule {
  const predicates = predicatesOf(filter)
  const bound = (field: string, fallback: number) =>
    predicates.some(p => p.field === field)
      ? (lowerBoundOf(predicates, field) ?? 0)
      : fallback
  return {
    minDepth: bound('depth', DEFAULT_INTERBASE_INDICATOR_RULE.minDepth),
    minFraction: bound(
      'fraction',
      DEFAULT_INTERBASE_INDICATOR_RULE.minFraction,
    ),
  }
}
