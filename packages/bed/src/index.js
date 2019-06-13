import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as BigBedAdapterClass,
  configSchema as bigBedAdapterConfigSchema,
} from './BigBedAdapter'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema: bigBedAdapterConfigSchema,
          AdapterClass: BigBedAdapterClass,
        }),
    )
  }
}
