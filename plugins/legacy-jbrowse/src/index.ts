import Plugin from '@jbrowse/core/Plugin'

import GuessNCListF from './GuessNCList/index.ts'
import JBrowse1ConnectionF from './JBrowse1Connection/index.ts'
import JBrowse1TextSearchAdapterF from './JBrowse1TextSearchAdapter/index.ts'
import NCListAdapterF from './NCListAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class LegacyJBrowsePlugin extends Plugin {
  name = 'LegacyJBrowsePlugin'

  install(pluginManager: PluginManager) {
    NCListAdapterF(pluginManager)
    GuessNCListF(pluginManager)
    JBrowse1TextSearchAdapterF(pluginManager)
    JBrowse1ConnectionF(pluginManager)
  }
}
