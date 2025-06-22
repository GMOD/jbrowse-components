import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureRenderer, {
  ReactComponent as CanvasFeatureRendererReactComponent,
  configSchema as canvasFeatureRendererConfigSchema,
} from './CanvasFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

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
  ReactComponent as CanvasFeatureRendererReactComponent,
  configSchema as canvasFeatureRendererConfigSchema,
} from './CanvasFeatureRenderer'
