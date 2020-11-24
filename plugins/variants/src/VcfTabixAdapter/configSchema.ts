import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'VcfTabixAdapter',
  {
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf.gz' },
    },
    index: ConfigurationSchema('VcfIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.vcf.gz.tbi' },
      },
    }),
  },
  { explicitlyTyped: true },
)
