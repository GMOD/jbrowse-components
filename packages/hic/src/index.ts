import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import HicRenderer, {
  configSchema as hicRendererConfigSchema,
  ReactComponent as HicRendererReactComponent,
} from './HicRenderer'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'HicAdapter',
          ...pluginManager.jbrequire(require('./HicAdapter')),
        }),
    )
    pluginManager.addRendererType(
      () =>
        new HicRenderer({
          name: 'HicRenderer',
          ReactComponent: HicRendererReactComponent,
          configSchema: hicRendererConfigSchema,
        }),
    )
  }
}
