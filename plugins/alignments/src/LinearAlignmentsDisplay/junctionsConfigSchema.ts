import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { JUNCTIONS_PLACEMENTS } from './constants.ts'
import { junctionLabelsConfigSchema } from './junctionLabelsConfigSchema.ts'

/**
 * #config Junctions
 * #category display
 * The alignments display's `junctions` setting: the junction arcs, over the
 * coverage band or in a strip above or below it, and in a strip of their own
 * while `coverage.show` is off. The band counts each splice junction from the
 * reads' N gaps, each deletion of 50 bp or more the reads carry as a D inside
 * one record (secondary alignments left out), and each same-reference join of
 * a split read's segments by its class (`junction.class`: `deletion`,
 * `duplication`, which a circRNA back-splice is, or `inversion`), once per
 * pair of read-adjacent segments as the read arcs count support. One junction
 * is one exact span of one kind, so a gapped and a split deletion on the same
 * span count apart. A split junction takes its class's read-arc color and a
 * gapped deletion the deletion-type one. Which junctions draw is the
 * display's `filter`, by its `junction` fields: `junction.source: gap` keeps
 * splices and gapped deletions, `junction.class: deletion` both spellings of
 * a deletion.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   junctions: { placement: 'auto', labels: { show: true } },
 *   filter: [
 *     { field: 'junction.reads', gte: 5 },
 *     { field: 'junction.canonical', equal: true },
 *     { field: 'junction.class', oneOf: ['splice', 'duplication'] },
 *   ],
 * }
 * ```
 */
export const junctionsConfigSchema = ConfigurationSchema(
  'Junctions',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the junction arcs',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 40,
      description:
        'height in pixels of the strip the arcs draw in above or below the coverage band',
    },
    /**
     * #slot
     */
    placement: {
      type: 'stringEnum',
      model: types.enumeration('JunctionsPlacement', [...JUNCTIONS_PLACEMENTS]),
      defaultValue: 'overlay',
      description:
        'where the arcs sit against the coverage band: overlay on its histogram, above in a strip of their own over it, below in a strip under it, or auto, which sends a junction below where it would cross another. With coverage hidden there is nothing to overlay: overlay and auto draw every arc hanging in the strip below, and above keeps its strip, arcs rising',
    },
    /**
     * #slot labels
     * The read count on each arc: `show`.
     */
    labels: junctionLabelsConfigSchema,
  },
  { closed: true, plot: true },
)
