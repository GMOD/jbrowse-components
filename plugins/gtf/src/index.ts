import Plugin from '@jbrowse/core/Plugin'

import GtfAdapterF from './GtfAdapter'
import GuessAdapterF from './GuessAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GtfPlugin extends Plugin {
  name = 'GTFPlugin'

  install(pluginManager: PluginManager) {
    GtfAdapterF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
