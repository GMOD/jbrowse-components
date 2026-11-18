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
 * the pileup's own rows are `pileup.connectors`. Both paint a connection
 * its insert size and orientation class, in the colors the reads'
 * `encoding.color` declares for that field, and the display's `filter` picks
 * the connections both draw, by its `connection` and `breakpoint` fields.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, mark: 'rule' },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, ordinaryPairs: { show: false } },
 *   filter: [{ field: 'connection.interchrom', equal: true }],
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: false },
 *   pileup: { connectors: { show: false } },
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
      description:
        'draw the band of arcs or the read cloud; pileup.connectors draws the connectors over the reads',
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
        "height in pixels of the connections' own band, drawn under placement: 'below' or 'above', or under 'overlay' while the coverage band is hidden; with coverage shown, overlay arcs draw in its height",
    },
    /**
     * #slot
     */
    placement: {
      type: 'stringEnum',
      model: types.enumeration('ReadConnectionsPlacement', [
        ...READ_CONNECTIONS_PLACEMENTS,
      ]),
      defaultValue: 'below',
      description:
        'where the connections sit against the coverage band: overlay on its histogram, above in a band of their own over it, or below in a band under it. With coverage hidden there is nothing to overlay, and overlay draws them rising in a band of their own',
    },
    /**
     * #slot encoding
     * The width each connection strokes at, `strokeWidth`.
     */
    encoding: readConnectionsEncodingConfigSchema,
    /**
     * #slot ordinaryPairs
     * The pairs with no category, drawn as context: `show`.
     */
    ordinaryPairs: readConnectionsOrdinaryPairsConfigSchema,
  },
  { closed: true, plot: true },
)
