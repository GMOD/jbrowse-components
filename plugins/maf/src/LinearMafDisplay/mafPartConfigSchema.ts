import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MafPart
 * #category display
 * One part drawn over the MAF display's rows, `alignments.inversions`,
 * `.frames` or `.reference`, which `show` turns on.
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
      description: 'draw this part',
    },
  },
  { closed: true, plot: true },
)
