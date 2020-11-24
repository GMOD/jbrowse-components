import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
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
