import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * #config DensityRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'DensityRenderer',
  {},
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema,
    explicitlyTyped: true,
  },
)

export default configSchema
