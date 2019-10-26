import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './CramAdapter'

export const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    cramLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.cram' },
    },
    craiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.cram.crai' },
    },
  },
  { explicitlyTyped: true },
)
