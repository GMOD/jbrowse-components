import { lazy } from 'react'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import Plugin from '@gmod/jbrowse-core/Plugin'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import MenuBarType from '@gmod/jbrowse-core/pluggableElementTypes/MenuBarType'

import {
  AboutDrawerWidgetModel,
  HelpDrawerWidgetModel,
  MainMenuBarModel,
  ImportConfigurationDrawerWidgetModel,
} from './model'

const MainMenuBarComponent = lazy(() => import('./components/MainMenuBar'))
const AboutDrawerWidgetComponent = lazy(() =>
  import('./components/AboutDrawerWidget'),
)
const HelpDrawerWidgetComponent = lazy(() =>
  import('./components/HelpDrawerWidget'),
)
const ImportConfigurationDrawerWidgetComponent = lazy(() =>
  import('./components/ImportConfigurationDrawerWidget'),
)

export default class MainMenuBar extends Plugin {
  install(pluginManager) {
    pluginManager.addMenuBarType(() => {
      const stateModel = MainMenuBarModel

      const configSchema = ConfigurationSchema('MainMenuBar', {})

      return new MenuBarType({
        name: 'MainMenuBar',
        configSchema,
        stateModel,
        LazyReactComponent: MainMenuBarComponent,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = AboutDrawerWidgetModel

      const configSchema = ConfigurationSchema('AboutDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'AboutDrawerWidget',
        heading: 'About',
        configSchema,
        stateModel,
        LazyReactComponent: AboutDrawerWidgetComponent,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = HelpDrawerWidgetModel

      const configSchema = ConfigurationSchema('HelpDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'HelpDrawerWidget',
        heading: 'Help',
        configSchema,
        stateModel,
        LazyReactComponent: HelpDrawerWidgetComponent,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = ImportConfigurationDrawerWidgetModel

      const configSchema = ConfigurationSchema(
        'ImportConfigurationDrawerWidget',
        {},
      )

      return new DrawerWidgetType({
        name: 'ImportConfigurationDrawerWidget',
        heading: 'Import Configuration',
        configSchema,
        stateModel,
        LazyReactComponent: ImportConfigurationDrawerWidgetComponent,
      })
    })
  }
}
