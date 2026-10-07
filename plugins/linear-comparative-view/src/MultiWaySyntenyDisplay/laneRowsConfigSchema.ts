import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config LaneRows
 * #category display
 * The multi-way synteny display's `rows`: one lane per assembly below the
 * anchor, so `assembly` is the one field, and the object is the arrangement a
 * reader gives the lanes, written whole as every display's `rows` is. `domain`
 * lists the lanes that stack first, in order, the rest following densest-first
 * so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
 * names the lanes drawn, empty drawing the track's lanes or every lane.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   rows: { domain: ['GCF_000346465.2', 'poplar'], kept: ['GCF_000346465.2', 'poplar', 'citrus'] },
 * }
 * ```
 */
export const laneRowsConfigSchema = ConfigurationSchema(
  'LaneRows',
  {
    /**
     * #slot field
     * `assembly`, the one field a lane can be.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('LaneRowsField', ['assembly']),
      defaultValue: 'assembly',
      description: 'assembly, the one field a lane can be',
    },
  },
  { baseConfiguration: rowsConfigSchema },
)
