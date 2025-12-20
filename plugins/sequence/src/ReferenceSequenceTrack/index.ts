import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import { createReferenceSeqTrackConfig } from './configSchema'
import { stringifyFASTA } from '../saveTrackFormats/fasta'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ReferenceSequenceTrackF(pluginManager: PluginManager) {
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
      ).views(() => ({
        saveTrackFileFormatOptions() {
          return {
            fasta: {
              name: 'FASTA',
              extension: 'fa',
              callback: stringifyFASTA,
            },
          }
        },
      })),
    })
  })
}
