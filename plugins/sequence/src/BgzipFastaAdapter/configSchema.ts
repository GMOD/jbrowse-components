import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz' },
    },
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz.fai' },
    },
    gziLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz.gzi' },
    },
  },
  { explicitlyTyped: true },
)
