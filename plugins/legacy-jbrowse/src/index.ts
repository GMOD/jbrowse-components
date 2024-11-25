import Plugin from '@jbrowse/core/Plugin'
import GuessNCListF from './GuessNCList'
import JBrowse1ConnectionF from './JBrowse1Connection'
import JBrowse1TextSearchAdapterF from './JBrowse1TextSearchAdapter'
import NCListAdapterF from './NCListAdapter'
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
