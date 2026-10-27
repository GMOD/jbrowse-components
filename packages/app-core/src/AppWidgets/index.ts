import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import HighlightIcon from '@mui/icons-material/Highlight'

import AboutWidgetF from './AboutWidget/index.ts'
import GridBookmarkWidgetF from './GridBookmarkWidget/index.ts'
import HelpWidgetF from './HelpWidget/index.ts'
import ImportSessionWidgetF from './ImportSessionWidget/index.ts'
import JobsListWidgetF from './JobsListWidget/index.ts'
import PluginStoreWidgetF from './PluginStoreWidget/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class AppWidgetsPlugin extends Plugin {
  name = 'AppWidgetsPlugin'

  install(pluginManager: PluginManager) {
    AboutWidgetF(pluginManager)
    GridBookmarkWidgetF(pluginManager)
    HelpWidgetF(pluginManager)
    ImportSessionWidgetF(pluginManager)
    JobsListWidgetF(pluginManager)
    PluginStoreWidgetF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Highlights',
        icon: HighlightIcon,
        onClick: (session: SessionWithWidgets) => {
          session.openWidget('GridBookmarkWidget', 'GridBookmark')
        },
      })
    }
  }
}
