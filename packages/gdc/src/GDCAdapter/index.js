import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './GDCAdapter'

export const configSchema = ConfigurationSchema(
  'GDCAdapter',
  {
    filters: {
      type: 'string',
      defaultValue: '{}',
    },
    case: {
      type: 'string',
      defaultValue: '',
    },
    size: {
      type: 'integer',
      defaultValue: 100,
    },
  },
  { explicitlyTyped: true },
)
