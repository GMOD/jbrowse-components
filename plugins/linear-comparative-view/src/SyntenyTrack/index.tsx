import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default function registerSyntenyTrack(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
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
