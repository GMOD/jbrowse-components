import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { MenuBarType } from '../../Plugin'
import HelloWorldMenuBarModelFactory from './model'

const HelloWorld = lazy(() => import('./components/HelloWorld'))

export default class extends Plugin {
  name = 'HelloWorldPlugin'

  install(pluginManager) {
    pluginManager.addMenuBarType(() => {
      const stateModel = HelloWorldMenuBarModelFactory(pluginManager)

      const configSchema = ConfigurationSchema('HelloWorldMenuBar', {})

      return new MenuBarType({
        name: 'HelloWorldMenuBar',
        configSchema,
        stateModel,
        LazyReactComponent: HelloWorld,
      })
    })
  }
}
