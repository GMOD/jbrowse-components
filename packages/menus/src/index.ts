import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { lazy } from 'react'
import {
  AbstractSessionModel,
  SessionWithDrawerWidgets,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import HelpIcon from '@material-ui/icons/Help'
import InfoIcon from '@material-ui/icons/Info'
import {
  configSchema as aboutConfigSchema,
  ReactComponent as AboutReactComponent,
  stateModel as aboutStateModel,
} from './AboutDrawerWidget'
import {
  configSchema as helpConfigSchema,
  ReactComponent as HelpReactComponent,
  stateModel as helpStateModel,
} from './HelpDrawerWidget'
import {
  configSchema as importConfigurationConfigSchema,
  ReactComponent as ImportConfigurationReactComponent,
  stateModel as importConfigurationStateModel,
} from './ImportConfigurationDrawerWidget'
import {
  configSchema as sessionManagerConfigSchema,
  ReactComponent as SessionManagerReactComponent,
  stateModel as sessionManagerStateModel,
} from './SessionManager'

export default class extends Plugin {
  name = 'MenusPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'AboutDrawerWidget',
        heading: 'About',
        configSchema: aboutConfigSchema,
        stateModel: aboutStateModel,
        LazyReactComponent: lazy(() => AboutReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'HelpDrawerWidget',
        heading: 'Help',
        configSchema: helpConfigSchema,
        stateModel: helpStateModel,
        LazyReactComponent: lazy(() => HelpReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'ImportConfigurationDrawerWidget',
        heading: 'Import Configuration',
        configSchema: importConfigurationConfigSchema,
        stateModel: importConfigurationStateModel,
        LazyReactComponent: lazy(() => ImportConfigurationReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'SessionManager',
        heading: 'Sessions',
        configSchema: sessionManagerConfigSchema,
        stateModel: sessionManagerStateModel,
        LazyReactComponent: lazy(() => SessionManagerReactComponent),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: InfoIcon,
        onClick: (session: SessionWithDrawerWidgets) => {
          const drawerWidget = session.addDrawerWidget(
            'AboutDrawerWidget',
            'aboutDrawerWidget',
          )
          session.showDrawerWidget(drawerWidget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: HelpIcon,
        onClick: (session: SessionWithDrawerWidgets) => {
          const drawerWidget = session.addDrawerWidget(
            'HelpDrawerWidget',
            'helpDrawerWidget',
          )
          session.showDrawerWidget(drawerWidget)
        },
      })
      pluginManager.rootModel.insertInMenu(
        'File',
        {
          label: 'Open Session…',
          icon: FolderOpenIcon,
          onClick: (session: SessionWithDrawerWidgets) => {
            const drawerWidget = session.addDrawerWidget(
              'SessionManager',
              'sessionManager',
            )
            session.showDrawerWidget(drawerWidget)
          },
        },
        1,
      )
      pluginManager.rootModel.insertInMenu(
        'File',
        {
          label: 'Duplicate Session',
          icon: FileCopyIcon,
          onClick: (session: AbstractSessionModel) => {
            session.duplicateCurrentSession()
          },
        },
        1,
      )
    }
  }
}
