import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseWiggleRendererConfigSchema from '../configSchema.ts'

/**
 * #config LinePlotRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {
    /**
     * #slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema,
    explicitlyTyped: true,
  },
)

export default configSchema
