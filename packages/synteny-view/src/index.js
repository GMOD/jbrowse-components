import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import {
  AdapterClass as MCScanAnchorsAdapterClass,
  configSchema as mcScanAnchorsAdapterConfigSchema,
} from './MCScanAnchorsAdapter'

export default class SyntenyViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SyntenyView')),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          configSchema: mcScanAnchorsAdapterConfigSchema,
          AdapterClass: MCScanAnchorsAdapterClass,
        }),
    )
  }

  configure() {}
}
