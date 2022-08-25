import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'VariantTrack',
      {},
      { baseConfiguration: createBaseTrackConfig(pluginManager) },
    )
    return new TrackType({
      name: 'VariantTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'VariantTrack',
        configSchema,
      ),
    })
  })
}
