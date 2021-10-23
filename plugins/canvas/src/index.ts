import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as canvasFeatureRendererConfigSchema,
  ReactComponent as CanvasFeatureRendererReactComponent,
} from './CanvasFeatureRenderer'

class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true
}

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
