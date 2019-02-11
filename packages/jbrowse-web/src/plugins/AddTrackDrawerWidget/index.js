import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
import AddTrackDrawerWidgetModel from './model'

const AddTrackDrawerWidgetComponent = lazy(() =>
  import('./components/AddTrackDrawerWidget'),
)

export default class MainMenuBar extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const stateModel = AddTrackDrawerWidgetModel

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
