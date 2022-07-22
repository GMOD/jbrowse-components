import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'MultiQuantitativeTrack',
      {},
      { baseConfiguration: createBaseTrackConfig(pluginManager) },
    )
    return new TrackType({
      name: 'MultiQuantitativeTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultiQuantitativeTrack',
        configSchema,
      ),
    })
  })
}
