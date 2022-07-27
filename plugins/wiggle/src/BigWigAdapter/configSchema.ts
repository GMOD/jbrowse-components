import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BigWigAdapter',
  {
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    },
    source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    },
  },
  { explicitlyTyped: true },
)
