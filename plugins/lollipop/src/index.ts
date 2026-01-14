import Plugin from '@jbrowse/core/Plugin'

import LinearLollipopDisplayF from './LinearLollipopDisplay/index.ts'
import LollipopRendererF from './LollipopRenderer/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class LollipopPlugin extends Plugin {
  name = 'LollipopPlugin'

  install(pluginManager: PluginManager) {
    LollipopRendererF(pluginManager)
    LinearLollipopDisplayF(pluginManager)
  }
}
