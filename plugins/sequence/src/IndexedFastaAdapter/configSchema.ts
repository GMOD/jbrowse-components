import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'IndexedFastaAdapter',
  {
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    },
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
    },
    headerLocation: {
      description:
        'Optional header metadata file. Specification can be found here: https://github.com/FFRGS/FFRGS-Specification',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.header.yaml',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)
