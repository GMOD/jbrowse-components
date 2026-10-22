import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { alignmentsArcColorConfigSchema } from './alignmentsArcColorConfigSchema.ts'
import {
  READ_CONNECTIONS_MARKS,
  READ_CONNECTIONS_PLACEMENTS,
} from './constants.ts'
import { readConnectionsOrdinaryPairsConfigSchema } from './readConnectionsOrdinaryPairsConfigSchema.ts'

/**
 * #config ReadConnections
 * #category display
 * The alignments display's `readConnections` setting: the band of
 * connections between mates and split segments, drawn as arcs or as the read
 * cloud, which plots each pair at its insert size. The connectors drawn over
 * the pileup's own rows are `pileup.showConnectors`, and which connections
 * either draws is the display's `filter.connections`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: {
 *     show: true,
 *     mark: 'cloud',
 *     color: { field: 'insertSize' },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, ordinaryPairs: { show: false } },
 *   filter: { connections: { interchrom: 'only' } },
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
     * #slot
     * The two share one band and differ in shape, y scale and one cut: an arc
     * rises with the span between its ends, and the cloud draws a flat line
     * at |TLEN| on a log scale and leaves the pairs of modal insert size out
     * unless `ordinaryPairs.show` keeps them.
     */
    mark: {
      type: 'stringEnum',
      model: types.enumeration('ReadConnectionsMark', [
        ...READ_CONNECTIONS_MARKS,
      ]),
      defaultValue: 'arc',
      description: "arc, or cloud: a flat line at each pair's insert size",
    },
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
     * #slot
     */
    lineWidth: {
      type: 'number',
      defaultValue: 1,
      description: 'width of each arc or line in pixels',
    },
    /**
     * #slot color
     * The field that colors the connections; `""` uses the reads' `color`
     * field where a connection paints it.
     */
    color: alignmentsArcColorConfigSchema,
    /**
     * #slot ordinaryPairs
     * The pairs that carry no category, drawn as context: `show`.
     */
    ordinaryPairs: readConnectionsOrdinaryPairsConfigSchema,
  },
  { closed: true, plot: true },
)
