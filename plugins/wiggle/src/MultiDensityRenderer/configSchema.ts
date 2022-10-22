import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * #config MultiDensityRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MultiDensityRenderer',
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
