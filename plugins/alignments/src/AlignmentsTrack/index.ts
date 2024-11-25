import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchemaF'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    const track = new TrackType({
      name: 'AlignmentsTrack',
      displayName: 'Alignments track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'AlignmentsTrack', configSchema),
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
