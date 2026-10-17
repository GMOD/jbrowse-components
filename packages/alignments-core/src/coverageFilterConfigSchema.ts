import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config CoverageFilter
 * #category display
 * The allele segments a coverage band colors, its `coverage.filter`. The
 * band's grey depth bar shows through where a segment is hidden.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { filter: { minAlleleFraction: 0.05 } },
 * }
 * ```
 */
export const coverageFilterConfigSchema = ConfigurationSchema(
  'CoverageFilter',
  {
    /**
     * #slot
     */
    minAlleleFraction: {
      type: 'number',
      defaultValue: 0,
      description:
        "an allele segment colors only with at least this share of its position's depth, so the band stops painting a sliver for every sequencing error at high depth; 0 colors every mismatch",
    },
  },
  { closed: true },
)

export interface CoverageFilter {
  minAlleleFraction: number
}
