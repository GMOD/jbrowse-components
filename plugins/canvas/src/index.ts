import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureRendererF from './CanvasFeatureRenderer/index.ts'
import registerGlyphs from './glyphs/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    registerGlyphs(pluginManager)
    CanvasFeatureRendererF(pluginManager)
  }
}
