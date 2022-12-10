import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'QuantitativeTrack',
      displayName: 'Quantitative track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'QuantitativeTrack',
        configSchema,
      ),
    })
  })
}
