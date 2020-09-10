import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true },
)

export const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true },
)
