import Plugin, { TrackType } from '../../Plugin'

import AlignmentsTrack from './components/AlignmentsTrack'
import configSchemaFactory from './configSchema'
import modelFactory from './model'
import pileupRenderer from './pileupRenderer'

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

    pluginManager.addRendererType(pileupRenderer)
  }
}
