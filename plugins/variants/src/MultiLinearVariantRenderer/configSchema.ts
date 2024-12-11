import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
    explicitlyTyped: true,
  },
)

export default configSchema
