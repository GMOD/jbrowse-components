import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import HelpIcon from '@mui/icons-material/Help'
import InfoIcon from '@mui/icons-material/Info'

import AboutWidgetF from './AboutWidget'
import HelpWidgetF from './HelpWidget'
import ImportSessionWidgetF from './ImportSessionWidget'
import SessionManagerF from './SessionManager'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class MenusPlugin extends Plugin {
  name = 'MenusPlugin'

  install(pluginManager: PluginManager) {
    AboutWidgetF(pluginManager)
    HelpWidgetF(pluginManager)
    ImportSessionWidgetF(pluginManager)
    SessionManagerF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: InfoIcon,
        shortcut: 'a',
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('AboutWidget', 'aboutWidget')
          session.showWidget(widget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: HelpIcon,
        shortcut: 'h',
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('HelpWidget', 'helpWidget')
          session.showWidget(widget)
        },
      })
    }
  }
}
