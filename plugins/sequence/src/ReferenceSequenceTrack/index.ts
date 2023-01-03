import PluginManager from '@jbrowse/core/PluginManager'

import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { createReferenceSeqTrackConfig } from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addTrackType(() => {
    const configSchema = createReferenceSeqTrackConfig(pluginManager)

    return new TrackType({
      name: 'ReferenceSequenceTrack',
      displayName: 'Reference sequence track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'ReferenceSequenceTrack',
        configSchema,
      ),
    })
  })
}
