import Plugin from '../../Plugin'
import TrackType from '../../pluggableElementTypes/TrackType'

import configSchemaFactory from './configSchema'
import modelFactory from './model'

export default class WiggleTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(pluginManager)
      const stateModel = modelFactory(pluginManager, configSchema)

      return new TrackType({
        name: 'WiggleTrack',
        configSchema,
        stateModel,
      })
    })
  }
}
