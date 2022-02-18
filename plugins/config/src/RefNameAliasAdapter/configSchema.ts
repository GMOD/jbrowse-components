import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    },
    refNameColumn: {
      type: 'number',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)
