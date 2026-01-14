import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchema.ts'
import { stringifyBedGraph } from '../saveTrackFormats/bedGraph.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function QuantitativeTrackF(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new TrackType({
      name: 'QuantitativeTrack',
      displayName: 'Quantitative track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'QuantitativeTrack',
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
