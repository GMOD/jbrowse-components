import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import LollipopRenderer, {
  configSchema as lollipopRendererConfigSchema,
  ReactComponent as LollipopRendererReactComponent,
} from './LollipopRenderer'

export default class extends Plugin {
  name = 'LollipopPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        // @ts-ignore error "expected 0 arguments, but got 1"?
        new LollipopRenderer({
          name: 'LollipopRenderer',
          ReactComponent: LollipopRendererReactComponent,
          configSchema: lollipopRendererConfigSchema,
        }),
    )
  }
}
