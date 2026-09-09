import Plugin from '@jbrowse/core/Plugin'

import LinearMarkDisplayF from './LinearMarkDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MarksPlugin extends Plugin {
  name = 'MarksPlugin'

  install(pluginManager: PluginManager) {
    LinearMarkDisplayF(pluginManager)
  }
}
