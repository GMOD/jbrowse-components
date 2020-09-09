import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  AdapterClass as BigBedAdapterClass,
  configSchema as bigBedAdapterConfigSchema,
} from './BigBedAdapter'
import {
  AdapterClass as BedTabixAdapterClass,
  configSchema as bedTabixAdapterConfigSchema,
} from './BedTabixAdapter'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema: bigBedAdapterConfigSchema,
          AdapterClass: BigBedAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BedTabixAdapter',
          configSchema: bedTabixAdapterConfigSchema,
          AdapterClass: BedTabixAdapterClass,
        }),
    )
  }
}
