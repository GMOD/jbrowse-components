import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export { default as AdapterClass } from './SNPAdapter'

export const configSchema = ConfigurationSchema(
  'SNPAdapter',
  {
    // verify extension names
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam' },
    },
    index: ConfigurationSchema('BamIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.bam.bai' },
      },
    }),
    cramLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.cram' },
    },
    craiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.cram.crai' },
    },
  },
  { explicitlyTyped: true },
)
