import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureRendererF from './CanvasFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    CanvasFeatureRendererF(pluginManager)
  }
}
