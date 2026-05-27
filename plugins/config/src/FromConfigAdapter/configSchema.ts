import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 */

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
