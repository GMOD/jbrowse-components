import Plugin from '../../Plugin'
import TrackType from '../../pluggableElementTypes/TrackType'

import factory from './model'

export default class FilteringTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const { configSchema, stateModel } = factory(pluginManager)
      return new TrackType({
        name: 'FilteringTrack',
        configSchema,
        stateModel,
      })
    })
  }
}
