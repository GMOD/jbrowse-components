import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * !config DensityRenderer
 */
const configSchema = ConfigurationSchema(
  'DensityRenderer',
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
