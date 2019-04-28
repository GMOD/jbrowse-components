import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import AlignmentsFeatureDrawerWidgetComponent from './components/AlignmentsFeatureDrawerWidget'

import configSchemaFactory from './configSchema'
import modelFactory, { AlignmentsFeatureDrawerWidgetModel } from './model'

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(pluginManager)

      const stateModel = modelFactory(pluginManager, configSchema)

      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = AlignmentsFeatureDrawerWidgetModel

      const configSchema = ConfigurationSchema(
        'AlignmentsFeatureDrawerWidget',
        {},
      )

      return new DrawerWidgetType({
        name: 'AlignmentsFeatureDrawerWidget',
        heading: 'Feature Details',
        configSchema,
        stateModel,
        LazyReactComponent: AlignmentsFeatureDrawerWidgetComponent,
      })
    })
  }
}
