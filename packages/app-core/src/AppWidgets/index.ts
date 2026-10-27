import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import HelpIcon from '@mui/icons-material/Help'
import InfoIcon from '@mui/icons-material/Info'

import AboutWidgetF from './AboutWidget/index.ts'
import HelpWidgetF from './HelpWidget/index.ts'
import ImportSessionWidgetF from './ImportSessionWidget/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class AppWidgetsPlugin extends Plugin {
  name = 'AppWidgetsPlugin'

  install(pluginManager: PluginManager) {
    AboutWidgetF(pluginManager)
    HelpWidgetF(pluginManager)
    ImportSessionWidgetF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: InfoIcon,
        onClick: (session: SessionWithWidgets) => {
          session.openWidget('AboutWidget', 'aboutWidget')
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: HelpIcon,
        onClick: (session: SessionWithWidgets) => {
          session.openWidget('HelpWidget', 'helpWidget')
        },
      })
    }
  }
}
