import Plugin from '../../Plugin'
import TrackType from '../../pluggableElementTypes/TrackType'

import AlignmentsTrack from './components/AlignmentsTrack'
import configSchemaFactory from './configSchema'
import modelFactory from './model'

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(pluginManager)

      const stateModel = modelFactory(pluginManager, configSchema)

      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel,
        RenderingComponent: AlignmentsTrack,
      })
    })
  }
}
