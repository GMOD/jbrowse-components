import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config DotplotAxis
 * #category view
 * The dotplot's `axis`: both genome axes, whose ticks `grid` carries across
 * the plot and `labels` numbers.
 *
 * #example
 * ```js
 * { type: 'DotplotView', axis: { grid: false, labels: false } }
 * ```
 */
export const dotplotAxisConfigSchema = ConfigurationSchema(
  'DotplotAxis',
  {
    /**
     * #slot
     */
    grid: {
      type: 'boolean',
      defaultValue: true,
      description: "carry each axis' ruler ticks across the plot",
    },
    /**
     * #slot
     */
    labels: {
      type: 'boolean',
      defaultValue: true,
      description:
        'number the ticks along each axis; off keeps the ticks and sequence names',
    },
  },
  { closed: true },
)
