import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * !config MultiDensityRenderer
 */
const configSchema = ConfigurationSchema(
  'MultiDensityRenderer',
  {},
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema,
    explicitlyTyped: true,
  },
)

export default configSchema
