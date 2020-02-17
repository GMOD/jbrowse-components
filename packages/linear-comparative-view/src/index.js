import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'

import {
  configSchemaFactory as comparativeTrackConfigSchemaFactory,
  stateModelFactory as comparativeTrackStateModelFactory,
} from './LinearComparativeTrack'

import {
  configSchemaFactory as syntenyTrackConfigSchemaFactory,
  stateModelFactory as syntenyTrackStateModelFactory,
} from './LinearSyntenyTrack'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearComparativeView')),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearSyntenyView')),
    )
    pluginManager.addTrackType(() => {
      const configSchema = comparativeTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'LinearComparativeTrack',
        configSchema,
        stateModel: comparativeTrackStateModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addTrackType(() => {
      const configSchema = syntenyTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'LinearSyntenyTrack',
        configSchema,
        stateModel: syntenyTrackStateModelFactory(pluginManager, configSchema),
      })
    })
  }
}
