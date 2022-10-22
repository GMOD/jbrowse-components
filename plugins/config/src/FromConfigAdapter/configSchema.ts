import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    /**
     * #slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
)
