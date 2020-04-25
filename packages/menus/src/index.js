import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
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
  install(pluginManager) {
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

  configure(pluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: 'info',
        onClick: session => {
          const drawerWidget = session.addDrawerWidget(
            'AboutDrawerWidget',
            'aboutDrawerWidget',
          )
          session.showDrawerWidget(drawerWidget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: 'help',
        onClick: session => {
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
          icon: 'folder_open',
          onClick: session => {
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
          icon: 'file_copy',
          onClick: session => {
            session.duplicateCurrentSession()
          },
        },
        1,
      )
    }
  }
}
