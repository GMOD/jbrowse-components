import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'Gff3Adapter',
  {
    gffLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
