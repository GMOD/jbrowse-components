import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SASHIMI_PLACEMENTS } from './constants.ts'

/**
 * #config Sashimi
 * #category display
 * The alignments display's `sashimi` setting: the splice-junction arcs, over
 * the coverage band or in a strip below it, and in that strip alone while
 * `coverage.show` is off. Which junctions draw is the display's
 * `filter.junctions`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   sashimi: { placement: 'auto', showCounts: true },
 *   filter: { junctions: { minReads: 5, nonCanonical: 'exclude' } },
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
        'where the arcs draw: up over the coverage histogram, down in a strip below it, or auto, which sends a junction down where it would cross another. Without the coverage band every arc draws down',
    },
    /**
     * #slot
     */
    showCounts: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the supporting-read count on each arc',
    },
  },
  { closed: true, plot: true },
)
