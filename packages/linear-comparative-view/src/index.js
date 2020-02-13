import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'

import {
  stateModelFactory as linearComparativeTrackModelFactory,
  configSchemaFactory as linearComparativeTrackConfigSchema,
} from './LinearComparativeTrack'

export default class LinearComparativeViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearComparativeView')),
    )

    pluginManager.addTrackType(() => {
      const configSchema = linearComparativeTrackConfigSchema(pluginManager)
      const stateModel = linearComparativeTrackModelFactory(
        pluginManager,
        configSchema,
      )
      console.log(configSchema, stateModel)
      return new TrackType({
        name: 'LinearComparativeTrack',
        configSchema,
        stateModel,
      })
    })
  }

  configure() {}
}
