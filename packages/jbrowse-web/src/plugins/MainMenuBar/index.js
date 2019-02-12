import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
import MenuBarType from '../../pluggableElementTypes/MenuBarType'

import {
  AboutDrawerWidgetModel,
  HelpDrawerWidgetModel,
  MainMenuBarModel,
  AssemblyEditorDrawerWidgetModel,
} from './model'

const MainMenuBarComponent = lazy(() => import('./components/MainMenuBar'))
const AboutDrawerWidgetComponent = lazy(() =>
  import('./components/AboutDrawerWidget'),
)
const HelpDrawerWidgetComponent = lazy(() =>
  import('./components/HelpDrawerWidget'),
)
const AssemblyEditorDrawerWidgetComponent = lazy(() =>
  import('./components/AssemblyEditorDrawerWidget'),
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
      const stateModel = AssemblyEditorDrawerWidgetModel

      const configSchema = ConfigurationSchema('AssemblyEditorDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'AssemblyEditorDrawerWidget',
        heading: 'Assemblies',
        configSchema,
        stateModel,
        LazyReactComponent: AssemblyEditorDrawerWidgetComponent,
      })
    })
  }
}
