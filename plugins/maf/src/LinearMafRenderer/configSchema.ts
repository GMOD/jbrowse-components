import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearMafRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'LinearMafRenderer',
  {
    baseColor: {
      type: 'color',
      defaultValue: 'lightgrey',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    explicitlyTyped: true,
  },
)

export default configSchema
