import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ReadConnectionsOrdinaryPairs
 * #category display
 * The read connections' `ordinaryPairs` layer: the pairs that carry no
 * category, drawn as context beside the ones that do. For arcs those are the
 * concordant pairs, for the read cloud the pairs of modal insert size.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, ordinaryPairs: { show: false } },
 * }
 * ```
 */
export const readConnectionsOrdinaryPairsConfigSchema = ConfigurationSchema(
  'ReadConnectionsOrdinaryPairs',
  {
    /**
     * #slot
     * Unset, the mark decides: arcs draw ordinary pairs as context and the
     * cloud leaves them out.
     */
    show: {
      type: 'maybeBoolean',
      description:
        'draw the ordinary pairs beside the ones carrying a category; unset follows the mark',
    },
  },
  { closed: true },
)
