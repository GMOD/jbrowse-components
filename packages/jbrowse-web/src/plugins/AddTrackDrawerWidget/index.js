import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
import AddTrackDrawerWidgetModelFactory from './model'

const AddTrackDrawerWidgetComponent = lazy(() =>
  import('./components/AddTrackDrawerWidget'),
)

export default class MainMenuBar extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const stateModel = AddTrackDrawerWidgetModelFactory(pluginManager)

      const configSchema = ConfigurationSchema('AddTrackDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'AddTrackDrawerWidget',
        heading: 'Add a track',
        configSchema,
        stateModel,
        LazyReactComponent: AddTrackDrawerWidgetComponent,
      })
    })
  }
}
