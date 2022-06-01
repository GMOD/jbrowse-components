import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
    },
    faiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.fai',
        locationType: 'UriLocation',
      },
    },
    metadataLocation: {
      description:
        'Optional header metadata file. Specification can be found here: https://github.com/FFRGS/FFRGS-Specification',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.header.yaml',
        locationType: 'UriLocation',
      },
    },
    gziLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)
