import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'

export default function HicTrackF(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'HicTrack',
      displayName: 'Hi-C track',
      configSchema,
      stateModel: createBaseTrackModel(pluginManager, 'HicTrack', configSchema),
    })
  })
}
