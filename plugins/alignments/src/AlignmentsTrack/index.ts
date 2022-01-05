import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'AlignmentsTrack',
    {},
    { baseConfiguration: createBaseTrackConfig(pluginManager) },
  )
}
export default function register(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const track = new TrackType({
      name: 'AlignmentsTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'AlignmentsTrack',
        configSchema,
      ),
    })
    const linearAlignmentsDisplay = pluginManager.getDisplayType(
      'LinearAlignmentsDisplay',
    )
    // Add LinearAlignmentsDisplay here so that it has priority over the other
    // linear displays (defaults to order the displays are added, but we have
    // to add the Pileup and SNPCoverage displays first).
    track.addDisplayType(linearAlignmentsDisplay)
    return track
  })
}
