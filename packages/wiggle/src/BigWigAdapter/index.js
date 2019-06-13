import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './BigWigAdapter'

export const configSchema = ConfigurationSchema(
  'BigWigAdapter',
  {
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bw' },
    },
  },
  { explicitlyTyped: true },
)
