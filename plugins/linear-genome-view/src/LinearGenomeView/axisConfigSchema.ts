import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearGenomeViewAxis
 * #category view
 * The linear genome view's `axis`: the ruler along its top, whose ticks
 * `grid` carries down through the tracks.
 *
 * #example
 * ```js
 * { type: 'LinearGenomeView', axis: { grid: false } }
 * ```
 */
export const linearGenomeViewAxisConfigSchema = ConfigurationSchema(
  'LinearGenomeViewAxis',
  {
    /**
     * #slot
     */
    grid: {
      type: 'boolean',
      defaultValue: true,
      description: "carry the ruler's ticks down through the tracks",
    },
  },
  { closed: true },
)
