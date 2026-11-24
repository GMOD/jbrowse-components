import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MafPart
 * #category display
 * One part drawn over the MAF display's rows, `alignments.inversions` or
 * `.frames`, which `show` turns on.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { inversions: { show: true } } }
 * ```
 */
export const mafPartConfigSchema = ConfigurationSchema(
  'MafPart',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description:
        "draw this part: under `inversions`, the hatching over each block a species aligns on the strand opposite its other blocks on that chromosome; under `frames`, each species' CDS reading-frame strip from the adapter's `framesAdapter`",
    },
  },
  { closed: true, plot: true },
)
