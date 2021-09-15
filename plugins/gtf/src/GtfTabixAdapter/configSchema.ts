import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'GtfTabixAdapter',
  {
    gtfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf.gz' },
    },
    index: ConfigurationSchema('GtfTabixIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.gtf.gz.tbi' },
      },
    }),
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region'],
    },
  },
  { explicitlyTyped: true },
)
