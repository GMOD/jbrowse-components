import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  const configSchema = configSchemaF(pluginManager)
  pluginManager.addTrackType(() => {
    return new TrackType({
      name: 'SyntenyTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'SyntenyTrack',
        configSchema,
      ),
    })
  })
}
