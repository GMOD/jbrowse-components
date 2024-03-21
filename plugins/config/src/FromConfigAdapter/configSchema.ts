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
      defaultValue: [],
      type: 'frozen',
    },
  },
  { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
)

export default configSchema
