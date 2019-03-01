import Plugin from '../../Plugin'
import TrackType from '../../pluggableElementTypes/TrackType'

import configSchemaFactory from './configSchema'
import modelFactory from './model'

export default class SequenceTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(pluginManager, 'SequenceTrack')
      const stateModel = modelFactory(
        pluginManager,
        configSchema,
        'SequenceTrack',
      )

      return new TrackType({
        name: 'SequenceTrack',
        configSchema,
        stateModel,
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(
        pluginManager,
        'ReferenceSequence',
      )
      const stateModel = modelFactory(
        pluginManager,
        configSchema,
        'ReferenceSequence',
      )

      return new TrackType({
        name: 'ReferenceSequence',
        configSchema,
        stateModel,
      })
    })
  }
}
