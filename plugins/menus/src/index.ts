import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { isAbstractMenuManager } from '@jbrowse/core/util'

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
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class MenusPlugin extends Plugin {
  name = 'MenusPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AboutWidget',
        heading: 'About',
        configSchema: aboutConfigSchema,
        stateModel: aboutStateModel,
        ReactComponent: lazy(
          () => import('./AboutWidget/components/AboutWidget'),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'HelpWidget',
        heading: 'Help',
        configSchema: helpConfigSchema,
        stateModel: helpStateModel,
        ReactComponent: lazy(
          () => import('./HelpWidget/components/HelpWidget'),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ImportSessionWidget',
        heading: 'Import session',
        configSchema: importSessionConfigSchema,
        stateModel: importSessionStateModel,
        ReactComponent: lazy(
          () => import('./ImportSessionWidget/components/ImportSessionWidget'),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'SessionManager',
        heading: 'Sessions',
        configSchema: sessionManagerConfigSchema,
        stateModel: sessionManagerStateModel,
        ReactComponent: lazy(
          () => import('./SessionManager/components/SessionManager'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: InfoIcon,
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('AboutWidget', 'aboutWidget')
          session.showWidget(widget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: HelpIcon,
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('HelpWidget', 'helpWidget')
          session.showWidget(widget)
        },
      })
    }
  }
}
