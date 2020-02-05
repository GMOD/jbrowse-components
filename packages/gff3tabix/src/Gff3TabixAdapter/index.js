import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './Gff3TabixAdapter'

export const configSchema = ConfigurationSchema(
  'Gff3TabixAdapter',
  {
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz' },
    },
    index: ConfigurationSchema('Gff3TabixIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.gff.gz.tbi' },
      },
    }),
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region'],
    },
    wtf: {
      type: 'string',
      defaultValue: 'wtf2',
    },
  },
  { explicitlyTyped: true },
)
