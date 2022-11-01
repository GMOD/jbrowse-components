import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
