import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './BgzipFastaAdapter'

export const configSchema = ConfigurationSchema(
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
