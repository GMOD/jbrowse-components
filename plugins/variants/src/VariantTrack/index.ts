import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'

export default (pm: PluginManager) => {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      configSchema,
      displayName: 'Variant track',
      name: 'VariantTrack',
      stateModel: createBaseTrackModel(pm, 'VariantTrack', configSchema),
    })
  })
}
