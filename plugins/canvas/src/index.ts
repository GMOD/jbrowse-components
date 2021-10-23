import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import CanvasFeatureRenderer, {
  configSchema as canvasFeatureRendererConfigSchema,
  ReactComponent as CanvasFeatureRendererReactComponent,
} from './CanvasFeatureRenderer'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new CanvasFeatureRenderer({
          name: 'CanvasFeatureRenderer',
          ReactComponent: CanvasFeatureRendererReactComponent,
          configSchema: canvasFeatureRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}

export {
  canvasFeatureRendererConfigSchema,
  CanvasFeatureRendererReactComponent,
}
