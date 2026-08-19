import Plugin from '@jbrowse/core/Plugin'

import SPARQLAdapterF from './SPARQLAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class RdfPlugin extends Plugin {
  name = 'RdfPlugin'

  install(pluginManager: PluginManager) {
    SPARQLAdapterF(pluginManager)
  }
}
