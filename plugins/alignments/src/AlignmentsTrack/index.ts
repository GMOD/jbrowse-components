import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config AlignmentsTrack
 * has very little config; most config and state logic is on the display
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'AlignmentsTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
export default function register(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaFactory(pm)
    const track = new TrackType({
      name: 'AlignmentsTrack',
      displayName: 'Alignments track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'AlignmentsTrack', configSchema),
    })
    const linearAlignmentsDisplay = pm.getDisplayType('LinearAlignmentsDisplay')
    // Add LinearAlignmentsDisplay here so that it has priority over the other
    // linear displays (defaults to order the displays are added, but we have
    // to add the Pileup and SNPCoverage displays first).
    track.addDisplayType(linearAlignmentsDisplay)
    return track
  })
}
