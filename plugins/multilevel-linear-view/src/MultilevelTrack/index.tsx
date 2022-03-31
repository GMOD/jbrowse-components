import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'MultilevelTrack',
      {},
      { baseConfiguration: createBaseTrackConfig(pluginManager) },
    )
    return new TrackType({
      name: 'MultilevelTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultilevelTrack',
        configSchema,
      ),
    })
  })
}
