import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 */

const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    /**
     * #slot
     * stable identifier used as the adapter cache key; avoids hashing the
     * (potentially large) features array. optional — falls back to hash.
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
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
