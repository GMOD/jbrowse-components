import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BigBedAdapter',
  {
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
