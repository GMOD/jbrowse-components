import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './TwoBitAdapter'

export const configSchema = ConfigurationSchema(
  'TwoBitAdapter',
  {
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit' },
    },
  },
  { explicitlyTyped: true },
)
