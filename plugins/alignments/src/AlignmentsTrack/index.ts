import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchemaF.ts'
import { stringifySAM } from '../saveTrackFormats/sam.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    const track = new TrackType({
      name: 'AlignmentsTrack',
      displayName: 'Alignments track',
      configSchema,
      stateModel: createBaseTrackModel(
        pm,
        'AlignmentsTrack',
        configSchema,
      ).views(() => ({
        saveTrackFileFormatOptions() {
          return {
            sam: {
              name: 'SAM',
              extension: 'sam',
              callback: stringifySAM,
              helpText:
                'Note: SAM format export is experimental and does not currently output optional tags. The output may not fully conform to the SAM specification and should be validated before use in production workflows.',
            },
          }
        },
      })),
    })
    const linearAlignmentsDisplay = pm.getDisplayType(
      'LinearAlignmentsDisplay',
    )!
    // Add LinearAlignmentsDisplay here so that it has priority over the other
    // linear displays (defaults to order the displays are added, but we have
    // to add the Pileup and SNPCoverage displays first).
    track.addDisplayType(linearAlignmentsDisplay)
    return track
  })
}
