import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { WidgetType, MenuBarType } from '../../Plugin'
import {
  HelloWorldWidgetModelFactory,
  HelloWorldMenuBarModelFactory,
} from './model'

const HelloWorldMenuBar = lazy(() => import('./components/HelloWorldMenuBar'))
const HelloWorldWidget = lazy(() =>
  import('./components/HelloWorldWidget'),
)

export default class extends Plugin {
  name = 'HelloWorldDrawerWidgetPlugin'

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

    pluginManager.addWidgetType(() => {
      const stateModel = HelloWorldWidgetModelFactory(pluginManager)

      const configSchema = ConfigurationSchema('HelloWorldWidget', {})

      return new WidgetType({
        name: 'HelloWorldWidget',
        configSchema,
        stateModel,
        LazyReactComponent: HelloWorldWidget,
      })
    })
  }
}
