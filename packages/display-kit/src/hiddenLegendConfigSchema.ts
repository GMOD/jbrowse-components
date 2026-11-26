import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { legendConfigSchema } from './legendConfigSchema.ts'

export { figureLegendConfigSchema } from './figureLegendConfigSchema.ts'

/**
 * #config HiddenLegend
 * #category display
 * The `legend` of a display whose key is off until asked for, the reads' fill.
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
