import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'HicAdapter',
  {
    hicLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.hic', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
