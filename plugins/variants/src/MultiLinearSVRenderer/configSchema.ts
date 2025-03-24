import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MultiSVRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MultiSVRenderer',
  {},
  {
    /**
     * #baseConfiguration
     */
    explicitlyTyped: true,
  },
)

export default configSchema
