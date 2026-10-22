import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config Legend
 * #category display
 * A display's `legend`: whether it draws its key, every channel's sections
 * together. Hiding one section is the key's own close button, which the
 * session forgets.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', legend: { show: false } }
 * ```
 */
export const legendConfigSchema = ConfigurationSchema(
  'Legend',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the key',
    },
  },
  { closed: true, plot: true },
)

/**
 * #config HiddenLegend
 * #category display
 * The `legend` of a display whose key is off until asked for, a matrix's
 * color ramp or the reads' fill.
 */
export const hiddenLegendConfigSchema = ConfigurationSchema(
  'HiddenLegend',
  {
    /**
     * #slot
     */
    show: { type: 'boolean', defaultValue: false },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: legendConfigSchema,
  },
)
