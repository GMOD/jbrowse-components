import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  configSchemaFactory as filteringTrackConfigSchemaFactory,
  modelFactory as filteringTrackModelFactory,
} from './FilteringTrack'

export default class extends Plugin {
  name = 'FilteringTrackPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = filteringTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'FilteringTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: filteringTrackModelFactory(configSchema),
      })
    })
  }
}
