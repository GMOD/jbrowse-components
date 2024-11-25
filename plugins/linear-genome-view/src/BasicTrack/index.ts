import {
  createBaseTrackModel,
  TrackType,
} from '@jbrowse/core/pluggableElementTypes'
import configSchemaF from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BasicTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)

    return new TrackType({
      name: 'BasicTrack',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'BasicTrack', configSchema),
    })
  })
}
