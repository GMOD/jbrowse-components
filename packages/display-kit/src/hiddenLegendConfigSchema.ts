import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { legendConfigSchema } from './legendConfigSchema.ts'

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
