import {
  TrackType,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'GWASTrack',
      displayName: 'GWAS track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'GWASTrack', configSchema),
    })
  })
}
