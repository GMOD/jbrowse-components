import {
  createBaseTrackModel,
  TrackType,
} from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        configSchema,
      ),
    })
  })
}
