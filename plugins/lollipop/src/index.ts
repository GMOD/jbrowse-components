import Plugin from '@jbrowse/core/Plugin'
import LinearLollipopDisplayF from './LinearLollipopDisplay'
import LollipopRendererF from './LollipopRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class LollipopPlugin extends Plugin {
  name = 'LollipopPlugin'

  install(pluginManager: PluginManager) {
    LollipopRendererF(pluginManager)
    LinearLollipopDisplayF(pluginManager)
  }
}
