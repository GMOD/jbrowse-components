import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LDTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'LDTrack',
      displayName: 'LD track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'LDTrack', configSchema),
    })
  })
}
