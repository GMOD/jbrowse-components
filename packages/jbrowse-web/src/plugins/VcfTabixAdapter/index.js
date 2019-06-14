import { types } from 'mobx-state-tree'
import Plugin from '@gmod/jbrowse-core/Plugin'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import VcfTabixAdapterClass from './VcfTabixAdapter'

const configSchema = ConfigurationSchema(
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

export default class VcfTabixAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'VcfTabixAdapter',
          configSchema,
          AdapterClass: VcfTabixAdapterClass,
        }),
    )
  }
}
