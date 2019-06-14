import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as VcfTabixAdapterClass,
  configSchema as vcfTabixAdapterConfigSchema,
} from './VcfTabixAdapter'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'VcfTabixAdapter',
          configSchema: vcfTabixAdapterConfigSchema,
          AdapterClass: VcfTabixAdapterClass,
        }),
    )
  }
}
