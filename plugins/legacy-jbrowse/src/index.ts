import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import NCListAdapterF from './NCListAdapter'
import JBrowse1TextSearchAdapterF from './JBrowse1TextSearchAdapter'
import JBrowse1ConnectionF from './JBrowse1Connection'
import GuessNCListF from './GuessNCList'

export default class LegacyJBrowsePlugin extends Plugin {
  name = 'LegacyJBrowsePlugin'

  install(pluginManager: PluginManager) {
    NCListAdapterF(pluginManager)
    GuessNCListF(pluginManager)
    JBrowse1TextSearchAdapterF(pluginManager)
    JBrowse1ConnectionF(pluginManager)
  }
}
