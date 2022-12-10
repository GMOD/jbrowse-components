import {
  createBaseTrackModel,
  TrackType,
} from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchemaF from './configSchema'

export default (pm: PluginManager) => {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'FeatureTrack',
      displayName: 'Feature track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'FeatureTrack', configSchema),
    })
  })
}
