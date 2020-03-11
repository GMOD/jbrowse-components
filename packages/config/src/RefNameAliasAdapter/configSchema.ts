import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    location: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my/aliases.txt' },
    },
  },
  { explicitlyTyped: true },
)
