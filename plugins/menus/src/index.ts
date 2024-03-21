import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { SessionWithWidgets, isAbstractMenuManager } from '@jbrowse/core/util'

import HelpIcon from '@mui/icons-material/Help'
import InfoIcon from '@mui/icons-material/Info'

import {
  configSchema as aboutConfigSchema,
  stateModel as aboutStateModel,
} from './AboutWidget'
import {
  configSchema as helpConfigSchema,
  stateModel as helpStateModel,
} from './HelpWidget'
import {
  configSchema as importSessionConfigSchema,
  stateModel as importSessionStateModel,
} from './ImportSessionWidget'
import {
  configSchema as sessionManagerConfigSchema,
  stateModel as sessionManagerStateModel,
} from './SessionManager'

export default class extends Plugin {
  name = 'MenusPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        ReactComponent: lazy(
          () => import('./AboutWidget/components/AboutWidget'),
        ),
        configSchema: aboutConfigSchema,
        heading: 'About',
        name: 'AboutWidget',
        stateModel: aboutStateModel,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        ReactComponent: lazy(
          () => import('./HelpWidget/components/HelpWidget'),
        ),
        configSchema: helpConfigSchema,
        heading: 'Help',
        name: 'HelpWidget',
        stateModel: helpStateModel,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        ReactComponent: lazy(
          () => import('./ImportSessionWidget/components/ImportSessionWidget'),
        ),
        configSchema: importSessionConfigSchema,
        heading: 'Import session',
        name: 'ImportSessionWidget',
        stateModel: importSessionStateModel,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        ReactComponent: lazy(
          () => import('./SessionManager/components/SessionManager'),
        ),
        configSchema: sessionManagerConfigSchema,
        heading: 'Sessions',
        name: 'SessionManager',
        stateModel: sessionManagerStateModel,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        icon: InfoIcon,
        label: 'About',
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('AboutWidget', 'aboutWidget')
          session.showWidget(widget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        icon: HelpIcon,
        label: 'Help',
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('HelpWidget', 'helpWidget')
          session.showWidget(widget)
        },
      })
    }
  }
}
