import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './FromConfigSequence'

export const configSchema = ConfigurationSchema(
  'FromConfigSequence',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
