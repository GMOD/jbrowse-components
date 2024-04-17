import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import LinearLollipopDisplayF from './LinearLollipopDisplay'
import LollipopRendererF from './LollipopRenderer'

export default class LollipopPlugin extends Plugin {
  name = 'LollipopPlugin'

  install(pluginManager: PluginManager) {
    LollipopRendererF(pluginManager)
    LinearLollipopDisplayF(pluginManager)
  }
}
