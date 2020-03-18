import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'

import {
  configSchemaFactory as dotplotTrackConfigSchemaFactory,
  stateModelFactory as dotplotTrackStateModelFactory,
} from './DotplotTrack'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./DotplotView')),
    )
    pluginManager.addTrackType(() => {
      const configSchema = dotplotTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DotplotTrack',
        configSchema,
        stateModel: dotplotTrackStateModelFactory(pluginManager, configSchema),
      })
    })
  }
}
