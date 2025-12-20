import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchema'
import { stringifyBedGraph } from '../saveTrackFormats/bedGraph'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiQuantitativeTrackF(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'MultiQuantitativeTrack',
      displayName: 'Multi-quantitative track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultiQuantitativeTrack',
        configSchema,
      ).views(() => ({
        saveTrackFileFormatOptions() {
          return {
            bedGraph: {
              name: 'BedGraph',
              extension: 'bedgraph',
              callback: stringifyBedGraph,
            },
          }
        },
      })),
    })
  })
}
