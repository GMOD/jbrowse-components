import modelFactory from './models'
import ReactComponent from './components/LinearGenomeView'

import Plugin from '../../Plugin'
import ViewType from '../../pluggableElementTypes/ViewType'

import configSchema from './models/configSchema'
import BasicTrackFactory from './BasicTrack'
import DynamicTrackFactory from './DynamicTrack'
import TrackType from '../../pluggableElementTypes/TrackType'

export default class LinearGenomeViewPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const { stateModel, configSchema: trackConfig } = BasicTrackFactory(
        pluginManager,
      )

      return new TrackType({
        name: 'BasicTrack',
        configSchema: trackConfig,
        stateModel,
      })
    })

    pluginManager.addTrackType(() => {
      const { stateModel, configSchema: trackConfig } = DynamicTrackFactory(
        pluginManager,
      )

      return new TrackType({
        name: 'DynamicTrack',
        configSchema: trackConfig,
        stateModel,
      })
    })

    pluginManager.addViewType(() => {
      this.installed = true

      return new ViewType({
        name: 'LinearGenomeView',
        stateModel: modelFactory(pluginManager),
        configSchema,
        ReactComponent,
      })
    })
  }
}
