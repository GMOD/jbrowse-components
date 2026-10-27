import Plugin from '@jbrowse/core/Plugin'

import AboutWidgetF from './AboutWidget/index.ts'
import HelpWidgetF from './HelpWidget/index.ts'
import ImportSessionWidgetF from './ImportSessionWidget/index.ts'
import JobsListWidgetF from './JobsListWidget/index.ts'
import PluginStoreWidgetF from './PluginStoreWidget/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AppWidgetsPlugin extends Plugin {
  name = 'AppWidgetsPlugin'

  install(pluginManager: PluginManager) {
    AboutWidgetF(pluginManager)
    HelpWidgetF(pluginManager)
    ImportSessionWidgetF(pluginManager)
    JobsListWidgetF(pluginManager)
    PluginStoreWidgetF(pluginManager)
  }
}
