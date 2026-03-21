import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function registerMultiSyntenyTrack(
  pluginManager: PluginManager,
) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'MultiSyntenyTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultiSyntenyTrack',
        configSchema,
      ),
    })
  })
}
