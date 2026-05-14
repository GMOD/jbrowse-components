import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearMafRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'LinearMafRenderer',
  {},
  {
    /**
     * #baseConfiguration
     */
    explicitlyTyped: true,
  },
)

export default configSchema
