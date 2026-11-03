import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import { stringifySAM } from '../saveTrackFormats/sam.ts'
import configSchemaF from './configSchemaF.ts'

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
                "Note: SAM export rebuilds records from the reads JBrowse loaded. The header lists the assembly's sequences rather than the file's, so read groups and programs are not carried over, and an optional tag's type is the one its value implies: a one-character A tag is written as Z.",
            },
          }
        },
      })),
    })
    const linearAlignmentsDisplay = pm.getDisplayType('LinearAlignmentsDisplay')
    // Add LinearAlignmentsDisplay here so that it has priority over the other
    // linear displays (defaults to order the displays are added, but we have
    // to add the Pileup and SNPCoverage displays first).
    track.addDisplayType(linearAlignmentsDisplay)
    return track
  })
}
