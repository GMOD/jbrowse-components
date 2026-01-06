import Plugin from '@jbrowse/core/Plugin'

import GtfAdapterF from './GtfAdapter/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GtfPlugin extends Plugin {
  name = 'GTFPlugin'

  install(pluginManager: PluginManager) {
    GtfAdapterF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
