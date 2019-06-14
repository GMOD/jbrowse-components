import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import MenuBarType from '@gmod/jbrowse-core/pluggableElementTypes/MenuBarType'
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
  configSchema as mainMenuBarConfigSchema,
  ReactComponent as MainMenuBarReactComponent,
  stateModel as mainMenuBarStateModel,
} from './MainMenuBar'

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

    pluginManager.addMenuBarType(() => {
      return new MenuBarType({
        name: 'MainMenuBar',
        configSchema: mainMenuBarConfigSchema,
        stateModel: mainMenuBarStateModel,
        LazyReactComponent: lazy(() => MainMenuBarReactComponent),
      })
    })
  }
}
