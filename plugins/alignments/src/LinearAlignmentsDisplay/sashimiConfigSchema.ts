import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SASHIMI_PLACEMENTS } from './constants.ts'
import { sashimiLabelsConfigSchema } from './sashimiLabelsConfigSchema.ts'

/**
 * #config Sashimi
 * #category display
 * The alignments display's `sashimi` setting: the splice-junction arcs, over
 * the coverage band or in a strip below it, and in that strip alone while
 * `coverage.show` is off. Which junctions draw is the display's `filter`, by
 * its `junction` fields.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   sashimi: { placement: 'auto', labels: { show: true } },
 *   filter: [
 *     { field: 'junction.reads', gte: 5 },
 *     { field: 'junction.canonical', equal: true },
 *   ],
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
     * #slot labels
     * The read count on each arc: `show`.
     */
    labels: sashimiLabelsConfigSchema,
  },
  { closed: true, plot: true },
)
