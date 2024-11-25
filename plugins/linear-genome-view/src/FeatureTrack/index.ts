import {
  createBaseTrackModel,
  TrackType,
} from '@jbrowse/core/pluggableElementTypes'
import configSchemaF from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureTrackF(pm: PluginManager) {
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
