import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
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
