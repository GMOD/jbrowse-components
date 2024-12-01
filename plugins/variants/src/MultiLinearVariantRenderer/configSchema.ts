import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * #config MultiVariantRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MultiVariantRenderer',
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
