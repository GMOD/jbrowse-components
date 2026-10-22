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
