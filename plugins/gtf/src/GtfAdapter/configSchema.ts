import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'GtfAdapter',
  {
    gtfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
