import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType, MenuBarType } from '../../Plugin'
import {
  HelloWorldDrawerWidgetModelFactory,
  HelloWorldMenuBarModelFactory,
} from './model'

const HelloWorldMenuBar = lazy(() => import('./components/HelloWorldMenuBar'))
const HelloWorldDrawerWidget = lazy(() =>
  import('./components/HelloWorldDrawerWidget'),
)

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addMenuBarType(() => {
      const stateModel = HelloWorldMenuBarModelFactory(pluginManager)

      const configSchema = ConfigurationSchema('HelloWorldMenuBar', {})

      return new MenuBarType({
        name: 'HelloWorldMenuBar',
        configSchema,
        stateModel,
        LazyReactComponent: HelloWorldMenuBar,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = HelloWorldDrawerWidgetModelFactory(pluginManager)

      const configSchema = ConfigurationSchema('HelloWorldDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'HelloWorldDrawerWidget',
        configSchema,
        stateModel,
        LazyReactComponent: HelloWorldDrawerWidget,
      })
    })
  }
}
