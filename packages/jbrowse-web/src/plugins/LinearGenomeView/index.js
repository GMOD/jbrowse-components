import modelFactory from './models/model'
import ReactComponent from './components/LinearGenomeView'

import Plugin, { ViewType } from '../../Plugin'

export default class LinearGenomeViewPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() => {
      const trackStateModels = pluginManager
        .getElementTypesInGroup('track')
        .map(pluggableTrack => {
          if (!pluggableTrack.stateModel)
            throw new Error(
              `track ${pluggableTrack.name} has no stateModel defined!`,
            )
          return pluggableTrack.stateModel
        })

      this.installed = true

      return new ViewType({
        name: 'LinearGenomeView',
        stateModel: modelFactory(trackStateModels),
        ReactComponent,
      })
    })
  }
}
