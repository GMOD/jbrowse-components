import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function VariantTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'VariantTrack',
      displayName: 'Variant track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'VariantTrack', configSchema),
    })
  })
}
