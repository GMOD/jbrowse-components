import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchemaFactory as filteringTrackConfigSchemaFactory,
  modelFactory as filteringTrackModelFactory,
} from './FilteringTrack'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = filteringTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'FilteringTrack',
        configSchema,
        stateModel: filteringTrackModelFactory(configSchema),
      })
    })
  }
}
