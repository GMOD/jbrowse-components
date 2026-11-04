import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaF from './configSchemaF.ts'

import type { stringifyCoverageBedGraph } from '../saveTrackFormats/coverage.ts'
import type { stringifySAM } from '../saveTrackFormats/sam.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

async function samText(args: Parameters<typeof stringifySAM>[0]) {
  const { stringifySAM } = await import('../saveTrackFormats/sam.ts')
  return stringifySAM(args)
}

async function coverageBedGraphText(
  args: Parameters<typeof stringifyCoverageBedGraph>[0],
) {
  const { stringifyCoverageBedGraph } =
    await import('../saveTrackFormats/coverage.ts')
  return stringifyCoverageBedGraph(args)
}

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
              callback: samText,
              helpText:
                "Note: SAM export rebuilds records from the reads JBrowse loaded. The header lists the assembly's sequences rather than the file's, so read groups and programs are not carried over, and an optional tag's type is the one its value implies: a one-character A tag is written as Z.",
            },
            coverage: {
              name: 'Coverage (bedGraph)',
              extension: 'bedgraph',
              callback: coverageBedGraphText,
              helpText:
                'The depth at each base of the reads this track shows, counted as the coverage band counts it: a deletion or a skipped intron adds no depth. Bases no read covers are left out.',
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
