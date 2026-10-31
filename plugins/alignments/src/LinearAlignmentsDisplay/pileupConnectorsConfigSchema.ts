import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupConnectors
 * #category display
 * The pileup's `connectors` layer: lines over the pileup rows joining each
 * read to its mate or split segment, colored by
 * insert size and orientation, as the reads' color of that name paints them.
 * The band of arcs or the read cloud is
 * `readConnections`.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', pileup: { connectors: { show: true } } }
 * ```
 */
export const pileupConnectorsConfigSchema = ConfigurationSchema(
  'PileupConnectors',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description:
        "draw a connector over the pileup from each read to its mate or split segment: straight for a normal pair within one displayed region, curved otherwise. Under unit: 'chain' a connector between displayed regions curves either way",
    },
  },
  { closed: true },
)
