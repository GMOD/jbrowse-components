import Plugin from '@jbrowse/core/Plugin'

// Import the function that registers CanvasFeatureRenderer
import CanvasFeatureRendererF from './CanvasFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    // Register CanvasFeatureRenderer using its registration function
    CanvasFeatureRendererF(pluginManager)
  }
}
