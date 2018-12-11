import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType } from '../../Plugin'
import DataHubDrawerWidgetModel from './model'

const DataHubDrawerWidgetComponent = lazy(() =>
  import('./components/DataHubDrawerWidget'),
)

export default class MainMenuBar extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const stateModel = DataHubDrawerWidgetModel

      const configSchema = ConfigurationSchema('DataHubDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'DataHubDrawerWidget',
        heading: 'Data Hubs',
        configSchema,
        stateModel,
        LazyReactComponent: DataHubDrawerWidgetComponent,
      })
    })
  }
}
