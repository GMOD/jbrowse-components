import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'

import {
  stateModelFactory as linearSyntenyTrackModelFactory,
  configSchemaFactory as linearSyntenyTrackConfigSchema,
} from './LinearSyntenyTrack'

export default class LinearSyntenyViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./LinearSyntenyView')),
    )

    pluginManager.addTrackType(() => {
      const configSchema = linearSyntenyTrackConfigSchema(
        pluginManager,
        'LinearSyntenyTrack',
      )
      return new TrackType({
        name: 'LinearSyntenyTrack',
        configSchema,
        stateModel: linearSyntenyTrackModelFactory(
          configSchema,
          'LinearSyntenyTrack',
        ),
      })
    })
  }

  configure() {}
}
