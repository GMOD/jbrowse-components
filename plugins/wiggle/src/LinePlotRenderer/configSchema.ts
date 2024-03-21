import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseWiggleRendererConfigSchema from '../configSchema'

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
      defaultValue: false,
      description: 'choose to draw cross hatches (sideways lines)',
      type: 'boolean',
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
