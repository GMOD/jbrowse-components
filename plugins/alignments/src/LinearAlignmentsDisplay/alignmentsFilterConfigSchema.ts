import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { baseAlignmentsFilterConfigSchema } from './baseAlignmentsFilterConfigSchema.ts'
import { junctionFilterConfigSchema } from './junctionFilterConfigSchema.ts'

/**
 * #config AlignmentsFilter
 * #category display
 * Every test the alignments display applies, in one object, its `filter`
 * slot, read by every part that draws the data a test names: the base filter's
 * read members and `connections`, and `junctions`, which tests the splice
 * junctions.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   filter: { junctions: { minReads: 5, nonCanonical: 'exclude' } },
 * }
 * ```
 */
export const alignmentsFilterConfigSchema = ConfigurationSchema(
  'AlignmentsFilter',
  {
    /**
     * #slot junctions
     * The splice junctions drawn: `minReads` (default 2) and `nonCanonical`.
     */
    junctions: junctionFilterConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseAlignmentsFilterConfigSchema,
  },
)
