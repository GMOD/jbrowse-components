import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      configSchema,
      displayName: 'Hi-C track',
      name: 'HicTrack',
      stateModel: createBaseTrackModel(pluginManager, 'HicTrack', configSchema),
    })
  })
}
