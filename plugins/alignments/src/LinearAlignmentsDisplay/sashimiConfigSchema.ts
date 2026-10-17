import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SASHIMI_PLACEMENTS } from './constants.ts'
import { sashimiFilterConfigSchema } from './sashimiFilterConfigSchema.ts'

/**
 * #config Sashimi
 * #category display
 * The alignments display's `sashimi` setting: the splice-junction arcs, drawn
 * in the coverage band, so they draw only while `coverage.show` is on.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   sashimi: {
 *     placement: 'auto',
 *     showCounts: true,
 *     filter: { minReads: 5, nonCanonical: 'exclude' },
 *   },
 * }
 * ```
 */
export const sashimiConfigSchema = ConfigurationSchema(
  'Sashimi',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the sashimi arcs',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 40,
      description:
        'height of the strip below coverage that down arcs draw in, in pixels',
    },
    /**
     * #slot
     */
    placement: {
      type: 'stringEnum',
      model: types.enumeration('SashimiPlacement', [...SASHIMI_PLACEMENTS]),
      defaultValue: 'up',
      description:
        'where the arcs draw: up over the coverage histogram, down in a strip below it, or auto, which sends a junction down where it would cross another',
    },
    /**
     * #slot
     */
    showCounts: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the supporting-read count on each arc',
    },
    /**
     * #slot filter
     * The junctions drawn: `minReads` (default 2) and `nonCanonical`.
     */
    filter: sashimiFilterConfigSchema,
  },
  { closed: true },
)
