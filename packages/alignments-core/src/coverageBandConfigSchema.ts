import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { coverageFilterConfigSchema } from './coverageFilterConfigSchema.ts'

export type { CoverageFilter } from './coverageFilterConfigSchema.ts'

/**
 * #config CoverageBand
 * #category display
 * The coverage histogram band of the alignments and MAF displays, their
 * `coverage` setting: whether it draws, its height, the insertion and clip
 * marks drawn in it, and which allele segments it colors. Its value axis is
 * the display's `scales`.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { height: 80 } }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { show: false } }
 * ```
 */
export const coverageBandConfigSchema = ConfigurationSchema(
  'CoverageBand',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the coverage band',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 45,
      description: 'height of the coverage band in pixels',
    },
    /**
     * #slot
     */
    showInterbaseIndicators: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the insertion and clip count bars and their indicator triangles',
    },
    /**
     * #slot filter
     * The allele segments the band colors: `minAlleleFraction`.
     */
    filter: coverageFilterConfigSchema,
  },
  { closed: true, plot: true },
)
