import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

function stringifyBedGraph({ features }: { features: Feature[] }) {
  return features
    .map(
      f =>
        `${f.get('refName')}\t${f.get('start')}\t${f.get('end')}\t${f.get('score') ?? 0}`,
    )
    .join('\n')
}

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
