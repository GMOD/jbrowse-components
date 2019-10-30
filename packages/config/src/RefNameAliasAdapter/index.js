import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './RefNameAliasAdapter'

export const configSchema = ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    location: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my/aliases.txt' },
    },
  },
  { explicitlyTyped: true },
)
