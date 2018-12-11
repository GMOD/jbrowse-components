import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType, MenuBarType } from '../../Plugin'
import {
  AboutDrawerWidgetModel,
  HelpDrawerWidgetModel,
  MainMenuBarModel,
} from './model'

const MainMenuBarComponent = lazy(() => import('./components/MainMenuBar'))
const AboutDrawerWidgetComponent = lazy(() =>
  import('./components/AboutDrawerWidget'),
)
const HelpDrawerWidgetComponent = lazy(() =>
  import('./components/HelpDrawerWidget'),
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
        configSchema,
        stateModel,
        LazyReactComponent: HelpDrawerWidgetComponent,
      })
    })
  }
}
