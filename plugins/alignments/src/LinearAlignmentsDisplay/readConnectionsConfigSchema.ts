import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { READ_CONNECTIONS_PLACEMENTS } from './constants.ts'
import { readConnectionsEncodingConfigSchema } from './readConnectionsEncodingConfigSchema.ts'
import { readConnectionsMarkConfigSchema } from './readConnectionsMarkConfigSchema.ts'
import { readConnectionsOrdinaryPairsConfigSchema } from './readConnectionsOrdinaryPairsConfigSchema.ts'

/**
 * #config ReadConnections
 * #category display
 * The alignments display's `readConnections` setting: the band of
 * connections between mates and split segments, drawn as arcs or as the read
 * cloud, which plots each pair at its insert size. The connectors drawn over
 * the pileup's own rows are `pileup.showConnectors`, and which connections
 * either draws is the display's `filter`, by its `connection` and
 * `breakpoint` fields.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: {
 *     show: true,
 *     mark: 'rule',
 *     encoding: { color: 'insertSize' },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, ordinaryPairs: { show: false } },
 *   filter: [{ field: 'connection.interchrom', equal: true }],
 * }
 * ```
 */
export const readConnectionsConfigSchema = ConfigurationSchema(
  'ReadConnections',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the read connections',
    },
    /**
     * #slot mark
     * The shape each connection draws as: `type` `link`, the arcs, or
     * `rule`, the read cloud.
     */
    mark: readConnectionsMarkConfigSchema,
    /**
     * #slot
     */
    height: {
      type: 'number',
      // Arcs scale to whatever band they get, so this only buys apex
      // separation between insert sizes; at 25 they were too flat to separate.
      // Kept above the 20px drag floor (clampBandHeight).
      defaultValue: 35,
      description:
        "height in pixels of the connections' own band, drawn under placement: 'down', or under 'up' while the coverage band is hidden; with coverage shown, up arcs draw in its height",
    },
    /**
     * #slot
     */
    placement: {
      type: 'stringEnum',
      model: types.enumeration('ReadConnectionsPlacement', [
        ...READ_CONNECTIONS_PLACEMENTS,
      ]),
      defaultValue: 'down',
      description:
        'where the connections draw: up over the coverage band, or down in a separate band below it',
    },
    /**
     * #slot encoding
     * The color and width each connection strokes at: `color`, a pair
     * field, `""` following the reads' `encoding.color` field where a
     * connection paints it, and `strokeWidth`.
     */
    encoding: readConnectionsEncodingConfigSchema,
    /**
     * #slot ordinaryPairs
     * The pairs that carry no category, drawn as context: `show`.
     */
    ordinaryPairs: readConnectionsOrdinaryPairsConfigSchema,
  },
  { closed: true, plot: true },
)
