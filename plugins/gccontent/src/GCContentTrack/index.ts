import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
// the same four columns QuantitativeTrack downloads, and this track renders the
// wiggle body anyway — a second copy of the writer was one place for the
// score-missing fallback to drift
import { stringifyBedGraph } from '@jbrowse/plugin-wiggle'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GCContentTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'GCContentTrack',
      displayName: 'GCContent track',
      configSchema,
      stateModel: createBaseTrackModel(
        pm,
        'GCContentTrack',
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
