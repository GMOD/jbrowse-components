import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function GCContentTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'GCContentTrack',
      displayName: 'GCContent track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'GCContentTrack', configSchema),
    })
  })
}
