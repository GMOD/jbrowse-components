import CanvasFeatureRenderer from './CanvasFeatureRenderer'
import ReactComponent from './components/CanvasFeatureRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CanvasFeatureRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new CanvasFeatureRenderer({
      name: 'CanvasFeatureRenderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}

export { default as ReactComponent } from './components/CanvasFeatureRendering'
export { default as configSchema } from './configSchema'